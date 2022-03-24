package io.hyperfoil.tools.horreum.entity.json;

import javax.persistence.Column;
import javax.persistence.Embeddable;
import javax.validation.constraints.NotNull;

@Embeddable
public class NamedJsonPath {
   @NotNull
   public String name;

   @NotNull
   public String jsonpath;

   @NotNull
   @Column(name = "isarray")
   public boolean array;
}
