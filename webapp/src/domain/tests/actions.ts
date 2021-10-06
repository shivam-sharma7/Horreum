import * as api from "./api"
import * as actionTypes from "./actionTypes"
import { accessName, Access } from "../../auth"
import {
    Test,
    View,
    LoadingAction,
    LoadedSummaryAction,
    LoadedTestAction,
    UpdateAccessAction,
    DeleteAction,
    UpdateTestWatchAction,
    UpdateViewAction,
    UpdateHookAction,
    UpdateTokensAction,
    RevokeTokenAction,
} from "./reducers"
import { Dispatch } from "redux"
import * as subscriptions from "./subscriptions-api"
import { Map } from "immutable"
import { alertAction, AddAlertAction, constraintValidationFormatter, dispatchError } from "../../alerts"
import { Hook } from "../hooks/reducers"

function loading(isLoading: boolean): LoadingAction {
    return { type: actionTypes.LOADING, isLoading }
}

export function fetchSummary(roles?: string) {
    return (dispatch: Dispatch<LoadingAction | LoadedSummaryAction | AddAlertAction>) => {
        dispatch(loading(true))
        return api.summary(roles).then(
            tests => dispatch({ type: actionTypes.LOADED_SUMMARY, tests }),
            error => {
                dispatch(loading(false))
                return dispatchError(dispatch, error, "FETCH_TEST_SUMMARY", "Failed to fetch test summary.")
            }
        )
    }
}

export function fetchTest(id: number) {
    return (dispatch: Dispatch<LoadingAction | LoadedTestAction | AddAlertAction>) => {
        dispatch(loading(true))
        return api.get(id).then(
            test => dispatch({ type: actionTypes.LOADED_TEST, test }),
            error => {
                dispatch(loading(false))
                return dispatchError(
                    dispatch,
                    error,
                    "FETCH_TEST",
                    "Failed to fetch test; the test may not exist or you don't have sufficient permissions to access it."
                )
            }
        )
    }
}

export function sendTest(test: Test) {
    return (dispatch: Dispatch<LoadedTestAction | AddAlertAction>) => {
        if (test.stalenessSettings && test.stalenessSettings.some(ss => !ss.maxStaleness || ss.maxStaleness <= 0)) {
            dispatch(alertAction("UPDATE_TEST", "Test update failed", "Invalid max staleness."))
            return Promise.reject()
        }
        return api.send(test).then(
            response => {
                dispatch({ type: actionTypes.LOADED_TEST, test })
                return response
            },
            error =>
                dispatchError(
                    dispatch,
                    error,
                    "UPDATE_TEST",
                    "Failed to create/update test " + test.name,
                    constraintValidationFormatter("the saved test")
                )
        )
    }
}

export function updateView(testId: number, view: View) {
    return (dispatch: Dispatch<UpdateViewAction | AddAlertAction>) => {
        for (const c of view.components) {
            if (c.accessors.trim() === "") {
                dispatch(
                    alertAction(
                        "VIEW_UPDATE",
                        "Column " + c.headerName + " is invalid; must set at least one accessor.",
                        undefined
                    )
                )
                return Promise.reject()
            }
        }
        return api.updateView(testId, view).then(
            response => {
                dispatch({
                    type: actionTypes.UPDATE_VIEW,
                    testId,
                    view,
                })
                return response
            },
            error =>
                dispatchError(
                    dispatch,
                    error,
                    "VIEW_UPDATE",
                    "View update failed. It is possible that some schema extractors used in this view do not use valid JSON paths."
                )
        )
    }
}

export function updateHooks(testId: number, testWebHooks: Hook[]) {
    return (dispatch: Dispatch<UpdateHookAction | AddAlertAction>) => {
        const promises: any[] = []
        testWebHooks.forEach(hook => {
            promises.push(
                api.updateHook(testId, hook).then(
                    response => {
                        dispatch({
                            type: actionTypes.UPDATE_HOOK,
                            testId,
                            hook,
                        })
                        return response
                    },
                    error =>
                        dispatchError(dispatch, error, "UPDATE_HOOK", `Failed to update hook ${hook.id} (${hook.url}`)
                )
            )
        })
        return Promise.all(promises)
    }
}

export function addToken(testId: number, value: string, description: string, permissions: number) {
    return (dispatch: Dispatch<UpdateTokensAction | AddAlertAction>) =>
        api.addToken(testId, value, description, permissions).then(
            () =>
                api.tokens(testId).then(
                    tokens =>
                        dispatch({
                            type: actionTypes.UPDATE_TOKENS,
                            testId,
                            tokens,
                        }),
                    error =>
                        dispatchError(dispatch, error, "FETCH_TOKENS", "Failed to fetch token list for test " + testId)
                ),
            error => dispatchError(dispatch, error, "ADD_TOKEN", "Failed to add token for test " + testId)
        )
}

export function revokeToken(testId: number, tokenId: number) {
    return (dispatch: Dispatch<RevokeTokenAction | AddAlertAction>) =>
        api.revokeToken(testId, tokenId).then(
            () =>
                dispatch({
                    type: actionTypes.REVOKE_TOKEN,
                    testId,
                    tokenId,
                }),
            error => dispatchError(dispatch, error, "REVOKE_TOKEN", "Failed to revoke token")
        )
}

export function updateAccess(id: number, owner: string, access: Access) {
    return (dispatch: Dispatch<UpdateAccessAction | AddAlertAction>) =>
        api.updateAccess(id, owner, accessName(access)).then(
            () => dispatch({ type: actionTypes.UPDATE_ACCESS, id, owner, access }),
            error =>
                dispatchError(
                    dispatch,
                    error,
                    "UPDATE_ACCESS",
                    "Test access update failed",
                    constraintValidationFormatter("the saved test")
                )
        )
}

export function deleteTest(id: number) {
    return (dispatch: Dispatch<DeleteAction | AddAlertAction>) =>
        api.deleteTest(id).then(
            () => dispatch({ type: actionTypes.DELETE, id }),
            error => dispatchError(dispatch, error, "DELETE_TEST", "Failed to delete test " + id)
        )
}

export function allSubscriptions() {
    return (dispatch: Dispatch<UpdateTestWatchAction | AddAlertAction>) =>
        subscriptions.all().then(
            response =>
                dispatch({
                    type: actionTypes.UPDATE_TEST_WATCH,
                    byId: Map(Object.entries(response).map(([key, value]) => [parseInt(key), value as string[]])),
                }),
            error => dispatchError(dispatch, error, "GET_ALL_SUBSCRIPTIONS", "Failed to fetch test subscriptions")
        )
}

export function addUserOrTeam(id: number, userOrTeam: string) {
    return (dispatch: Dispatch<UpdateTestWatchAction | AddAlertAction>) => {
        dispatch({
            type: actionTypes.UPDATE_TEST_WATCH,
            byId: Map([[id, undefined]]),
        })
        return subscriptions.addUserOrTeam(id, userOrTeam).then(
            response =>
                dispatch({
                    type: actionTypes.UPDATE_TEST_WATCH,
                    byId: Map([[id, response as string[]]]),
                }),
            error => dispatchError(dispatch, error, "ADD_SUBSCRIPTION", "Failed to add test subscriptions")
        )
    }
}

export function removeUserOrTeam(id: number, userOrTeam: string) {
    return (dispatch: Dispatch<UpdateTestWatchAction | AddAlertAction>) => {
        dispatch({
            type: actionTypes.UPDATE_TEST_WATCH,
            byId: Map([[id, undefined]]),
        })
        return subscriptions.removeUserOrTeam(id, userOrTeam).then(
            response =>
                dispatch({
                    type: actionTypes.UPDATE_TEST_WATCH,
                    byId: Map([[id, response as string[]]]),
                }),
            error => dispatchError(dispatch, error, "REMOVE_SUBSCRIPTION", "Failed to remove test subscriptions")
        )
    }
}
