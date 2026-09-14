# Multi-Tenancy & Authorization Model

## Core Tenancy Hierarchy

```text
User
 └── Workspace Membership
      └── Workspace
           ├── Receptionists and transfer destinations
           ├── Knowledge sources and chunks
           ├── Contacts, leads, and messages
           ├── Services and appointments
           ├── Calendar integrations
           ├── Communications and templates
           └── Audit logs
```

## Mandatory Tenant Scoping

Every tenant-owned database record contains a `workspaceId` foreign key.

> **CRITICAL SECURITY PRINCIPLE**:
> Knowledge of a workspace ID or slug never grants access to that workspace.

Client-supplied `workspaceId` or `workspaceSlug` headers and route parameters are treated as unverified inputs. Every incoming request must prove:

1. An authenticated active user session (`req.user`).
2. An active `WorkspaceMembership` linking that specific user to that specific `workspaceId`.
3. Sufficient role permissions matching the requested operation.

If any check fails, the API responds with `403 Forbidden` (or a non-enumerating `404 Not Found`).

## Role-Based Access Control (RBAC) Matrix

| Permission         | OWNER | ADMIN | AGENT_MANAGER | RECEPTION_STAFF | VIEWER |
| :----------------- | :---: | :---: | :-----------: | :-------------: | :----: |
| `workspace.read`   |  ✅   |  ✅   |      ✅       |       ✅        |   ✅   |
| `workspace.manage` |  ✅   |  ✅   |      ❌       |       ❌        |   ❌   |
| `members.read`     |  ✅   |  ✅   |      ✅       |       ❌        |   ❌   |
| `members.manage`   |  ✅   |  ✅   |      ❌       |       ❌        |   ❌   |
| `security.manage`  |  ✅   |  ❌   |      ❌       |       ❌        |   ❌   |
| `audit.read`       |  ✅   |  ✅   |      ❌       |       ❌        |   ❌   |

## Owner Safeguards

The system strictly forbids:

- Removing the only active `OWNER` from a workspace.
- Demoting the only active `OWNER` to an administrative or staff role.
- An `ADMIN` or non-owner attempting to grant the `OWNER` role or modify an existing owner.
