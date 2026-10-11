# Roles and permissions

LC-04 adds explicit role grants on top of LC-03 authentication. An active organization membership is necessary for organization-scoped access but never sufficient. Callers must also hold one active version-1 grant whose organization and, where required, competition match the requested resource.

## Role scopes and actions

| Role | Required scope | Allowed protected actions |
| --- | --- | --- |
| Platform operator | Platform only | `platform.manage` |
| Tenant operator | Organization | `tenant.manage`, `event.manage`, `content.view_private` |
| Event producer | Organization and competition | `event.manage`, `content.view_private` |
| Performer | Organization and competition | `performance.submit`, `content.view_private` |
| Judge | Organization and competition | `judging.score`, `content.view_private` |
| Viewer | Organization | `content.view_private` |
| Industry/scout | Organization | `industry.discover`, `content.view_private` |

The matrix deliberately does not imply role inheritance. A platform operator is not automatically a tenant operator, a producer cannot score as a judge, and a judge cannot submit as a performer. Assign multiple grants when one account has multiple duties.

## Fail-closed rules

Authorization rejects unsupported grant versions, invalid role/scope combinations, future, expired or revoked grants, competition requests without an organization, and any organization or competition mismatch. Competition-scoped grants are tied to competitions in the same organization. Organization-scoped grants are tied to an active membership by database foreign key.

Revocation preserves the old row as evidence. A replacement grant is a new row; the partial unique index permits only one unrevoked grant for the same account, role and scope. Version 1 is the only recognized policy format. A future policy version must ship with an explicit migration and authorization implementation before grants using it can authorize requests.

Public content remains outside this protected-action matrix. Later milestones must use these generic actions at API/service boundaries and may add narrower actions without broadening existing grants implicitly.
