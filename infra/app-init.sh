PORT_OFFSET="${1:-0}"

echo "Initializing Horreum Application"

KEYCLOAK_PORT=$((8180 + PORT_OFFSET))
HORREUM_PORT=$((8080 + PORT_OFFSET))
POSTGRES_PORT=$((5432 + PORT_OFFSET))

if [ "$CONTAINER_RUNTIME" = "podman" ]; then
  IP_ADDR="127.0.0.1"
else
  IP_ADDR="172.17.0.1"
fi

JDBC_URL="jdbc:postgresql://$IP_ADDR:$POSTGRES_PORT/horreum"
echo "# Env generated by app-init.sh" > /cwd/horreum-backend/.env
echo "QUARKUS_DATASOURCE_JDBC_URL=$JDBC_URL" >> /cwd/horreum-backend/.env
echo "QUARKUS_DATASOURCE_MIGRATION_JDBC_URL=$JDBC_URL" >> /cwd/horreum-backend/.env
echo "QUARKUS_OIDC_AUTH_SERVER_URL=http://$IP_ADDR:$KEYCLOAK_PORT/auth/realms/horreum" >> /cwd/horreum-backend/.env
KEYCLOAK_HOST="$IP_ADDR:$KEYCLOAK_PORT"
# Keycloak URL must match QUARKUS_OIDC_AUTH_SERVER_URL or we have to set QUARKUS_OIDC_TOKEN_ISSUER
echo "HORREUM_KEYCLOAK_URL=http://"$KEYCLOAK_HOST"/auth" >> /cwd/horreum-backend/.env

while ! curl -s --fail $KEYCLOAK_HOST; do
  echo 'Waiting for Keycloak to start.'
  sleep 5;
done
KEYCLOAK_ADMIN_TOKEN=$(curl -s $KEYCLOAK_HOST/auth/realms/master/protocol/openid-connect/token -X POST -H 'content-type: application/x-www-form-urlencoded' -d 'username=admin&password=secret&grant_type=password&client_id=admin-cli' | jq -r .access_token)
[ -n "$KEYCLOAK_ADMIN_TOKEN" -a "$KEYCLOAK_ADMIN_TOKEN" != "null" ] || exit 1
AUTH='Authorization: Bearer '$KEYCLOAK_ADMIN_TOKEN
KEYCLOAK_BASEURL=$KEYCLOAK_HOST/auth/admin/realms/horreum

# Obtain client secrets for both Horreum and Grafana
HORREUM_CLIENTID=$(curl -s $KEYCLOAK_BASEURL/clients -H "$AUTH" | jq -r '.[] | select(.clientId=="horreum") | .id')
HORREUM_CLIENTSECRET=$(curl -s $KEYCLOAK_BASEURL/clients/$HORREUM_CLIENTID/client-secret -X POST -H "$AUTH" | jq -r '.value')
[ -n "$HORREUM_CLIENTSECRET" -a "$HORREUM_CLIENTSECRET" != "null" ] || exit 1
echo QUARKUS_OIDC_CREDENTIALS_SECRET=$HORREUM_CLIENTSECRET >> /cwd/horreum-backend/.env
chmod a+w /cwd/horreum-backend/.env
GRAFANA_CLIENTID=$(curl -s $KEYCLOAK_BASEURL/clients -H "$AUTH" | jq -r '.[] | select(.clientId=="grafana") | .id')
GRAFANA_CLIENTSECRET=$(curl -s $KEYCLOAK_BASEURL/clients/$GRAFANA_CLIENTID/client-secret -X POST -H "$AUTH" | jq -r '.value')
[ -n "$GRAFANA_CLIENTSECRET" -a "$GRAFANA_CLIENTSECRET" != "null" ] || exit 1
echo GF_AUTH_GENERIC_OAUTH_CLIENT_SECRET=$GRAFANA_CLIENTSECRET > /cwd/.grafana
chmod a+w /cwd/.grafana

# Create roles and example user in Keycloak
UPLOADER_ID=$(curl -s $KEYCLOAK_BASEURL/roles/uploader -H "$AUTH"  | jq -r '.id')
TESTER_ID=$(curl -s $KEYCLOAK_BASEURL/roles/tester -H "$AUTH" | jq -r '.id')
VIEWER_ID=$(curl -s $KEYCLOAK_BASEURL/roles/viewer -H "$AUTH" | jq -r '.id')
ADMIN_ID=$(curl -s $KEYCLOAK_BASEURL/roles/admin -H "$AUTH" | jq -r '.id')
curl -s $KEYCLOAK_BASEURL/roles -H "$AUTH" -H 'content-type: application/json' -X POST -d '{"name":"dev-team"}'
TEAM_ID=$(curl -s $KEYCLOAK_BASEURL/roles/dev-team -H "$AUTH" | jq -r '.id')

curl -s $KEYCLOAK_BASEURL/roles -H "$AUTH" -H 'content-type: application/json' -X POST -d '{"name":"dev-viewer","composite":true}'
TEAM_VIEWER_ID=$(curl -s $KEYCLOAK_BASEURL/roles/dev-viewer -H "$AUTH" | jq -r '.id')
curl -s $KEYCLOAK_BASEURL/roles/dev-viewer/composites -H "$AUTH" -H 'content-type: application/json' -X POST -d '[{"id":"'$TEAM_ID'"},{"id":"'$VIEWER_ID'"}]'

curl -s $KEYCLOAK_BASEURL/roles -H "$AUTH" -H 'content-type: application/json' -X POST -d '{"name":"dev-uploader","composite":true}'
TEAM_UPLOADER_ID=$(curl -s $KEYCLOAK_BASEURL/roles/dev-uploader -H "$AUTH" | jq -r '.id')
curl -s $KEYCLOAK_BASEURL/roles/dev-uploader/composites -H "$AUTH" -H 'content-type: application/json' -X POST -d '[{"id":"'$TEAM_ID'"},{"id":"'$UPLOADER_ID'"}]'

curl -s $KEYCLOAK_BASEURL/roles -H "$AUTH" -H 'content-type: application/json' -X POST -d '{"name":"dev-tester","composite":true}'
TEAM_TESTER_ID=$(curl -s $KEYCLOAK_BASEURL/roles/dev-tester -H "$AUTH" | jq -r '.id')
curl -s $KEYCLOAK_BASEURL/roles/dev-tester/composites -H "$AUTH" -H 'content-type: application/json' -X POST -d '[{"id":"'$TEAM_ID'"},{"id":"'$TESTER_ID'"},{"id":"'$TEAM_VIEWER_ID'"}]'

curl -s $KEYCLOAK_BASEURL/roles -H "$AUTH" -H 'content-type: application/json' -X POST -d '{"name":"dev-manager","composite":true}'
TEAM_MANAGER_ID=$(curl -s $KEYCLOAK_BASEURL/roles/dev-manager -H "$AUTH" | jq -r '.id')
curl -s $KEYCLOAK_BASEURL/roles/dev-manager/composites -H "$AUTH" -H 'content-type: application/json' -X POST -d '[{"id":"'$TEAM_ID'"}]'

curl -s $KEYCLOAK_BASEURL/users -H "$AUTH" -X POST -d '{"username":"user","enabled":true,"firstName":"Dummy","lastName":"User","credentials":[{"type":"password","value":"secret"}],"email":"user@example.com"}' -H 'content-type: application/json'
USER_ID=$(curl -s $KEYCLOAK_BASEURL/users -H "$AUTH" | jq -r '.[] | select(.username=="user") | .id')
curl -s $KEYCLOAK_BASEURL/users/$USER_ID/role-mappings/realm -H "$AUTH" -H 'content-type: application/json' -X POST -d '[{"id":"'$TEAM_UPLOADER_ID'","name":"dev-uploader"},{"id":"'$TEAM_TESTER_ID'","name":"dev-tester"},{"id":"'$TEAM_VIEWER_ID'","name":"dev-viewer"},{"id":"'$TEAM_MANAGER_ID'","name":"dev-manager"},{"id":"'$ADMIN_ID'","name":"admin"}]'

ACCOUNT_CLIENTID=$(curl -s $KEYCLOAK_BASEURL/clients -H "$AUTH" | jq -r '.[] | select(.clientId=="account") | .id')
VIEW_PROFILE_ID=$(curl -s $KEYCLOAK_BASEURL/clients/${ACCOUNT_CLIENTID}/roles/view-profile -H "$AUTH" | jq -r '.id')
curl -s $KEYCLOAK_BASEURL/users/$USER_ID/role-mappings/clients/$ACCOUNT_CLIENTID -H "$AUTH" -H 'content-type: application/json' -X POST -d '[{"id":"'$VIEW_PROFILE_ID'","name":"view-profile"}]'

echo "Horreum initialization complete"