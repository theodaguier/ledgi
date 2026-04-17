# Ledgi API Reference

Complete reference documentation for the Ledgi REST API. This document is the authoritative source for all API endpoints, parameters, authentication mechanisms, and data models.

**For agent AI**: Read this file first for any question about the API. All endpoints follow REST conventions with JSON bodies and responses. Every API key is scoped to a single workspace.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Authentication](#2-authentication)
3. [Error Handling](#3-error-handling)
4. [Accounts](#4-accounts)
5. [Transactions](#5-transactions)
6. [Categories](#6-categories)
7. [Rules](#7-rules)
8. [Imports](#8-imports)
9. [Banks](#9-banks)
10. [Data Models](#10-data-models)
11. [Advanced Search & Filtering](#11-advanced-search--filtering)
12. [Server Actions (Internal)](#12-server-actions-internal)

---

## 1. Overview

### Base URL

```
https://your-domain.com/api/v1
```

### Versioning

The API is versioned via the URL path (`/api/v1/`). Breaking changes will result in a new version (`/api/v2/`). Non-breaking additions (new fields, new endpoints) do not require a version bump.

### Content Type

All requests and responses use `application/json`. Date values in request bodies and query parameters follow `YYYY-MM-DD` (ISO 8601 date-only format).

### Workspace Scoping

**Every data operation is scoped to the workspace of the API key.**

An API key is created for a specific user and workspace. All `GET`, `POST`, `PATCH`, `DELETE` operations on the `/api/v1/` endpoints automatically filter to the workspace bound to the API key. You cannot access data from another workspace with the same API key.

### Response Envelope

All list endpoints return a consistent envelope:

```json
{
  "data": [...],
  "pagination": {
    "total": 142,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

Single-resource endpoints return the resource directly.

---

## 2. Authentication

### API Key Authentication

The API uses Bearer token authentication via API keys. API keys are created through the Ledgi UI (Workspace Settings > API Keys).

**Header:**

```
Authorization: Bearer fk_abcdefghijkl...
```

**Key format:** `fk_` prefix followed by 32 characters from base64url encoding (24 random bytes). Example: `fk_A1b2C3d4E5f6G7h8I9j0K1l2M3N4O5p6`

**Key storage:** Only the SHA-256 hash of the full key is stored in the database, along with a 12-character prefix for efficient lookup.

**Key lifecycle:**
- Creation: generate raw key → store SHA-256 hash + prefix + metadata
- Verification: extract prefix from token → lookup by prefix → compare SHA-256 hash → check expiration → update `lastUsedAt`
- Expiration: optional, set at creation time; expired keys return `401 Unauthorized`

### Scopes

Every API key has one or more scopes that grant specific permissions. Scopes are enforced server-side; missing scope returns `403 Forbidden`.

| Scope | Description |
|---|---|
| `transactions.read` | Read transaction list and summaries |
| `transactions.write` | Create/update/delete transactions |
| `summary.read` | Read aggregated expense/income totals |
| `accounts.read` | Read bank accounts |
| `accounts.write` | Create/update/delete bank accounts |
| `categories.read` | Read categories |
| `categories.write` | Create/update/delete categories |
| `rules.read` | Read categorization rules |
| `rules.write` | Create/update/delete categorization rules |
| `imports.read` | Read import batches |
| `imports.create` | Create (import) new transactions from CSV |
| `imports.delete` | Delete import batches and their transactions |

**Note:** There is no standalone `rules.read` in the codebase — rules are returned within category or transaction responses but the `rules.write` scope is the only one related to rules that exists.

### Authentication Flow

1. Client sends request with `Authorization: Bearer <api_key>`
2. Server extracts the Bearer token
3. Server looks up keys matching the token's 12-char prefix (indexed lookup)
4. Server compares SHA-256 hash of token against stored hash
5. Server checks `expiresAt` (if set) against current time
6. Server checks required scope for the endpoint
7. If all pass: proceed; if any fail: return error

### Alternative: Session Authentication

Some endpoints (profile, avatar) use Better Auth session authentication instead of API keys. These endpoints are not part of `/api/v1/` and are for internal UI use only.

---

## 3. Error Handling

### Standard Error Format

All errors return a JSON object with an `error` field:

```json
{
  "error": "Human-readable error message"
}
```

### HTTP Status Codes

| Code | Meaning | When Used |
|---|---|---|
| `200` | OK | Successful GET, PATCH, DELETE |
| `201` | Created | Successful POST that creates a resource |
| `400` | Bad Request | Missing/invalid parameters, malformed body |
| `401` | Unauthorized | Missing or invalid API key |
| `403` | Forbidden | Valid API key but missing required scope |
| `404` | Not Found | Resource does not exist or not in workspace |
| `409` | Conflict | Resource already exists or cannot be deleted due to constraints |
| `500` | Internal Server Error | Unexpected server error |

### Error Response Examples

```json
// 401 Unauthorized
{ "error": "Unauthorized" }

// 400 Bad Request
{ "error": "Invalid body: name required" }

// 403 Forbidden
{ "error": "Forbidden" }

// 404 Not Found
{ "error": "Transaction not found" }

// 409 Conflict
{ "error": "Cannot delete an account with existing transactions" }
```

---

## 4. Accounts

Bank accounts represent checking, savings, credit card, or investment accounts within a workspace.

**Scope required:** `accounts.read` (GET), `accounts.write` (POST, PATCH, DELETE)

### `GET /api/v1/accounts`

Retrieve all bank accounts in the workspace.

**Query parameters:** None.

**Response `200`:**

```json
{
  "data": [
    {
      "id": "ckvabc123...",
      "name": "Compte Courant BNP",
      "type": "CHECKING",
      "bankName": "BNP Paribas",
      "bankInstitutionId": "BNP_PARIBAS_BNPAFRPPXXX",
      "accountNumber": "FR76 1234...",
      "referenceBalance": "5000.00",
      "referenceBalanceDate": "2025-01-15T10:30:00.000Z",
      "currentBalance": "6523.45",
      "currency": "EUR",
      "isActive": true,
      "transactionCount": 87,
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

**Notes:**
- `referenceBalance` is the known balance at `referenceBalanceDate` (stored in DB as Decimal, returned as string)
- `currentBalance` is computed as `referenceBalance + sum of transactions after referenceBalanceDate`
- `transactionCount` is the total number of transactions linked to this account

---

### `POST /api/v1/accounts`

Create a new bank account.

**Request body:**

```json
{
  "name": "Livret A",
  "type": "SAVINGS",
  "bankName": "La Banque Postale",
  "bankInstitutionId": "LA_BANQUE_POSTALE_LAPOFRPPXXX",
  "accountNumber": "12345678901",
  "referenceBalance": 5000.00,
  "referenceBalanceDate": "2025-04-17",
  "currency": "EUR"
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | **Yes** | — | Display name for the account |
| `type` | `AccountType` | No | `CHECKING` | Account type |
| `bankName` | `string` | No | `null` | Name of the bank |
| `bankInstitutionId` | `string` | No | `null` | GoCardless/Nordigen institution ID, used to resolve bank logo |
| `accountNumber` | `string` | No | `null` | Full or partial account number |
| `referenceBalance` | `number` | No | `0` | Known balance at the reference date |
| `referenceBalanceDate` | `string` (ISO date) | No | `null`, or current timestamp if `referenceBalance` is provided | Date at which `referenceBalance` is accurate. Transactions after this date are used to compute `currentBalance`. When `referenceBalance` is provided without `referenceBalanceDate`, the current server timestamp is used automatically. |
| `currency` | `string` | No | `"EUR"` | Currency code (ISO 4217) |

**`AccountType` values:** `CHECKING`, `SAVINGS`, `CREDIT_CARD`, `INVESTMENT`, `OTHER`

**Response `201`:**

```json
{
  "id": "ckvabc123...",
  "name": "Livret A",
  "type": "SAVINGS",
  "bankName": "La Banque Postale",
  "bankInstitutionId": "LA_BANQUE_POSTALE_LAPOFRPPXXX",
  "accountNumber": "12345678901",
  "referenceBalance": "5000.00",
  "referenceBalanceDate": "2025-04-17T00:00:00.000Z",
  "currency": "EUR",
  "isActive": true,
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

**Errors:**
- `400`: `name` is missing or empty

---

### `PATCH /api/v1/accounts/[id]`

Update a bank account. All fields are optional; only provided fields are updated.

**Path parameters:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` (CUID) | Account ID |

**Request body:**

```json
{
  "name": "Nouveau Nom",
  "type": "SAVINGS",
  "bankName": "Autre Banque",
  "bankInstitutionId": "AUTRE_BANQUE_XXXXFRPPXXX",
  "accountNumber": "98765432109",
  "referenceBalance": 6000.00,
  "referenceBalanceDate": "2025-04-17",
  "currency": "EUR"
}
```

**Response `200`:**

```json
{
  "id": "ckvabc123...",
  "name": "Nouveau Nom",
  "bankName": "Autre Banque",
  "referenceBalance": "6000.00",
  "referenceBalanceDate": "2025-04-17T00:00:00.000Z",
  "currentBalance": "6523.45",
  "currency": "EUR",
  "isActive": true,
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

**Errors:**
- `404`: Account not found or not in workspace

---

### `DELETE /api/v1/accounts/[id]`

Delete a bank account.

**Path parameters:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` (CUID) | Account ID |

**Response `200`:** `{ "success": true }`

**Errors:**
- `404`: Account not found or not in workspace

**Business rule:** Deleting an account cascade-deletes all its transactions via `ON DELETE CASCADE` at the database level.

---

## 5. Transactions

Transactions represent individual financial movements (debits, credits, transfers, fees) imported from bank statements or created manually.

**Scope required:** `transactions.read` (GET), `transactions.write` (PATCH, DELETE, bulk)

### `GET /api/v1/transactions`

List and filter transactions in the workspace. Returns a paginated list ordered by `dateOperation`.

**Query parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `preset` | `string` | No | — | Date range preset: `"today"`, `"last7d"`, `"month"` |
| `from` | `YYYY-MM-DD` | No | — | Custom start date (use with `to`) |
| `to` | `YYYY-MM-DD` | No | — | Custom end date (use with `from`) |
| `sort` | `string` | No | `"desc"` | Sort order: `"asc"` or `"desc"` by `dateOperation` |
| `category` | `string` | No | — | Filter by category ID, or `"uncategorized"` for null category |
| `account` | `string` | No | — | Filter by bank account ID |
| `user` | `string` | No | — | Filter by owner user ID |
| `q` | `string` | No | — | Full-text search in `label`, `labelNormalized`, `merchant` (case-insensitive) |
| `limit` | `integer` | No | `50` | Page size, max `200` |
| `offset` | `integer` | No | `0` | Pagination offset (0-indexed) |
| `pinned` | `string` | No | — | Filter pinned transactions: `"1"` for pinned only, `"0"` for unpinned only |

**Preset behavior:**
- `"today"`: Current calendar day (00:00:00 to now)
- `"last7d"`: Last 7 days including today
- `"month"`: Current calendar month (first day to last day)

**Custom date behavior:**
- `from` and `to` are parsed as `YYYY-MM-DD`
- If only `from` is provided, returns from that date to now
- If only `to` is provided, returns from the start of the month to that date
- If both are provided, the earlier date is treated as `from` and later as `to`
- Invalid date formats are silently ignored

**Response `200`:**

```json
{
  "data": [
    {
      "id": "ckvxyz789...",
      "dateOperation": "2025-04-15T00:00:00.000Z",
      "label": "CARREFOUR MARKET",
      "labelNormalized": "carrefour market",
      "merchant": "carrefour",
      "amount": "-42.50",
      "currency": "EUR",
      "type": "DEBIT",
      "confidence": 0.95,
      "category": {
        "id": "ckvcat001...",
        "name": "Courses",
        "slug": "courses",
        "color": "#4CAF50",
        "icon": "shopping-cart"
      },
      "bankAccount": {
        "id": "ckvacc001...",
        "name": "Compte Courant BNP"
      },
      "isAutomatic": true,
      "ownerUserId": "ckvuser001...",
      "createdAt": "2025-04-15T08:23:00.000Z",
      "note": "Remboursement attendu",
      "pinned": false
    }
  ],
  "pagination": {
    "total": 142,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

**Notes:**
- `amount` is returned as a string with sign (`"-42.50"` for debits, `"120.00"` for credits)
- `labelNormalized` is the label lowercased and trimmed
- `merchant` is extracted from the label (first word or recognized merchant name)
- `confidence` is a float 0-1 indicating categorization confidence
- `note` is an optional free-text annotation (null when not set)
- `pinned` is a boolean indicating whether the transaction is pinned for quick access

---

### `GET /api/v1/transactions/summary`

Get aggregated totals for expenses, income, and transfers over a period.

**Query parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `preset` | `string` | No | `"month"` | Date range preset: `"today"`, `"last7d"`, `"month"` |
| `from` | `YYYY-MM-DD` | No | Start of current month | Custom start date |
| `to` | `YYYY-MM-DD` | No | End of current month | Custom end date |
| `user` | `string` | No | — | Filter by owner user ID |

**Response `200`:**

```json
{
  "period": {
    "preset": "month",
    "from": "2025-04-01T00:00:00.000Z",
    "to": "2025-05-01T00:00:00.000Z"
  },
  "expenses": 2340.50,
  "income": 3200.00,
  "transfers": 500.00,
  "netBalance": 859.50,
  "uncategorizedCount": 3
}
```

**Notes:**
- `netBalance` = `income` - `expenses` (transfers are excluded)
- `uncategorizedCount` counts transactions with `categoryId: null` in the period (not filtered by date range for this count)
- All amounts are plain numbers (not strings)

---

### `PATCH /api/v1/transactions/[id]`

Update a transaction's category, note, and/or pinned status. Also learns the manual label association for future automatic categorization when `categoryId` is provided.

**Path parameters:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` (CUID) | Transaction ID |

**Request body:**

```json
{
  "categoryId": "ckvcat001..." | null,
  "note": "Optional annotation text",
  "pinned": true
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `categoryId` | `string \| null` | No | Category ID to assign, or `null` to uncategorize. When provided, triggers manual label learning. |
| `note` | `string \| null` | No | Free-text annotation. Pass `null` to clear. |
| `pinned` | `boolean` | No | Whether the transaction is pinned. |

**Side effects:**
- If `categoryId` is provided (including `null`): creates or updates a `ManualLabelCategory` entry mapping `labelNormalized + type` → `categoryId`. This enables future automatic categorization.
- If `categoryId` is `null`: deletes any existing `ManualLabelCategory` for this label+type pair.
- `note` and `pinned` can be updated independently without triggering category learning.

**Response `200`:**

```json
{
  "id": "ckvxyz789...",
  "dateOperation": "2025-04-15T00:00:00.000Z",
  "label": "CARREFOUR MARKET",
  "amount": "-42.50",
  "currency": "EUR",
  "type": "DEBIT",
  "category": {
    "id": "ckvcat001...",
    "name": "Courses",
    "slug": "courses",
    "color": "#4CAF50",
    "icon": "shopping-cart"
  },
  "bankAccount": {
    "id": "ckvacc001...",
    "name": "Compte Courant BNP"
  },
  "note": "Remboursement attendu",
  "pinned": true
}
```

**Errors:**
- `400`: Request body is missing or invalid
- `404`: Transaction not found or not in workspace

---

### `DELETE /api/v1/transactions/[id]`

Permanently delete a transaction.

**Path parameters:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` (CUID) | Transaction ID |

**Response `200`:** `{ "success": true }`

**Errors:**
- `404`: Transaction not found or not in workspace

**Note:** Deleting a transaction does NOT uncategorize it or trigger any side effects. The deletion is permanent.

---

### `POST /api/v1/transactions/bulk/category`

Bulk-update the category for multiple transactions. Also learns manual label associations for each unique label+type pair.

**Request body:**

```json
{
  "transactionIds": ["ckvtx001...", "ckvtx002...", "ckvtx003..."],
  "categoryId": "ckvcat001..." | null
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `transactionIds` | `string[]` | **Yes** | Array of transaction IDs (min 1) |
| `categoryId` | `string \| null` | **Yes** | Category ID to assign, or `null` to uncategorize |

**Side effects:** Same as PATCH `[id]` — creates/updates/deletes `ManualLabelCategory` entries for each unique `(labelNormalized, type)` pair among the transactions, deduped per pair.

**Response `200`:**

```json
{
  "updatedCount": 3
}
```

**Errors:**
- `400`: `transactionIds` is missing, not an array, or empty
- `404`: Any transaction not found (all must belong to workspace)

---

## 6. Categories

Categories are used to classify transactions. Categories can be system-defined (pre-seeded, cannot be deleted) or user-defined.

**Scope required:** `categories.read` (implicit via transactions), `categories.write` (POST, PATCH, DELETE)

### `POST /api/v1/categories`

Create a new category.

**Request body:**

```json
{
  "name": "Abonnements",
  "description": "Services recurents ( Netflix, Spotify, etc.)",
  "isIncome": false,
  "icon": "video",
  "color": "#9C27B0"
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | **Yes** | — | Display name (slug auto-generated) |
| `description` | `string` | No | `null` | Optional description |
| `isIncome` | `boolean` | No | `false` | Whether this category represents income |
| `icon` | `string` | No | `null` | Icon identifier |
| `color` | `string` | No | `null` | Hex color code (e.g., `#9C27B0`) |

**Slug generation:** Auto-generated from `name`: lowercase, spaces replaced by `-`, non-alphanumeric chars removed, leading/trailing dashes removed. e.g., `"Mon Abonnement"` → `"mon-abonnement"`.

**Response `201`:**

```json
{
  "id": "ckvcat002...",
  "name": "Abonnements",
  "slug": "abonnements",
  "description": "Services recurents ( Netflix, Spotify, etc.)",
  "color": "#9C27B0",
  "icon": "video",
  "isSystem": false,
  "isIncome": false,
  "createdAt": "2025-04-15T10:30:00.000Z"
}
```

**Errors:**
- `400`: `name` is missing or empty
- `409`: A category with the same slug already exists in the workspace

---

### `PATCH /api/v1/categories/[id]`

Update a category. System categories (`isSystem: true`) cannot be modified.

**Path parameters:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` (CUID) | Category ID |

**Request body** (all fields optional):

```json
{
  "name": "Nouveau Nom",
  "description": "Updated description",
  "isIncome": true,
  "icon": "star",
  "color": "#FF5722"
}
```

**Slug update:** If `name` is changed, the slug is regenerated.

**Response `200`:**

```json
{
  "id": "ckvcat002...",
  "name": "Nouveau Nom",
  "slug": "nouveau-nom",
  "description": "Updated description",
  "color": "#FF5722",
  "icon": "star",
  "isSystem": false,
  "isIncome": true,
  "createdAt": "2025-04-15T10:30:00.000Z"
}
```

**Errors:**
- `404`: Category not found, is a system category, or not in workspace

---

### `DELETE /api/v1/categories/[id]`

Delete a category. System categories cannot be deleted. Transactions using this category are uncategorized (set `categoryId` to `null`). Rules pointing to this category are deleted.

**Path parameters:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` (CUID) | Category ID |

**Response `200`:** `{ "success": true }`

**Side effects:**
- All transactions in the workspace with this `categoryId` are set to `null`
- All `CategorizationRule` entries pointing to this category are deleted

**Errors:**
- `404`: Category not found or is a system category

---

## 7. Rules

Categorization rules define patterns for automatically assigning categories to transactions based on label matching. Rules are evaluated in priority order (lower number = higher priority).

**Scope required:** `rules.write` (POST, PATCH, DELETE)

### Rule Data Model

| Field | Type | Description |
|---|---|---|
| `id` | `string` (CUID) | Unique identifier |
| `name` | `string` | Human-readable name |
| `priority` | `integer` | Evaluation order (0 = highest). Auto-assigned as `existingCount` on creation. |
| `matchType` | `MatchType` | Pattern matching strategy |
| `pattern` | `string` | The pattern to match against the transaction label |
| `categoryId` | `string` | Target category ID |
| `isActive` | `boolean` | Whether the rule is active |
| `description` | `string?` | Optional description |
| `category` | `object` | The target category (id, name, slug) |

### `MatchType` Values

| Value | Description | Example |
|---|---|---|
| `EXACT` | Full string exact match (case-insensitive) | pattern `"CARREFOUR"` matches `"CARREFOUR MARKET"` |
| `CONTAINS` | Pattern appears anywhere in the label | pattern `"CARREFOUR"` matches `"CARREFOUR MARKET"` |
| `STARTS_WITH` | Label starts with the pattern | pattern `"CARRE"` matches `"CARREFOUR MARKET"` |
| `ENDS_WITH` | Label ends with the pattern | pattern `"MARKET"` matches `"CARREFOUR MARKET"` |
| `REGEX` | PCRE-compatible regex | pattern `"^CARRE.*MARKET$"` |
| `KEYWORD` | Word-boundary match (normalized labels) | pattern `"carrefour"` matches `"CARREFOUR MARKET"` (normalized to lowercase) |

### `POST /api/v1/rules`

Create a new categorization rule.

**Request body:**

```json
{
  "name": "Carrefour Courses",
  "pattern": "carrefour",
  "matchType": "CONTAINS",
  "categoryId": "ckvcat001...",
  "description": "Match all Carrefour transactions"
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | **Yes** | — | Rule name |
| `pattern` | `string` | **Yes** | — | Pattern to match |
| `categoryId` | `string` | **Yes** | — | Target category ID |
| `matchType` | `MatchType` | No | `"CONTAINS"` | Matching strategy |
| `description` | `string` | No | `null` | Optional description |

**Priority:** Auto-assigned as the next available priority (e.g., if 5 rules exist, new rule gets priority 5). Rules are evaluated in ascending priority order.

**Response `201`:**

```json
{
  "id": "ckvrule001...",
  "name": "Carrefour Courses",
  "priority": 5,
  "matchType": "CONTAINS",
  "pattern": "carrefour",
  "description": "Match all Carrefour transactions",
  "isActive": true,
  "category": {
    "id": "ckvcat001...",
    "name": "Courses",
    "slug": "courses"
  },
  "createdAt": "2025-04-15T10:30:00.000Z"
}
```

**Errors:**
- `400`: `name`, `pattern`, or `categoryId` missing
- `404`: `categoryId` not found (checks both workspace categories and system categories)

---

### `PATCH /api/v1/rules`

Update a rule (identified by `id` in request body).

**Request body:**

```json
{
  "id": "ckvrule001...",
  "name": "Updated Rule Name",
  "pattern": "carrefour",
  "matchType": "KEYWORD",
  "categoryId": "ckvcat002...",
  "description": "Updated description",
  "isActive": false
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | **Yes** | Rule ID |
| `name` | `string` | No | New rule name |
| `pattern` | `string` | No | New pattern |
| `matchType` | `MatchType` | No | New matching strategy |
| `categoryId` | `string` | No | New target category |
| `description` | `string` | No | New description |
| `isActive` | `boolean` | No | Toggle rule active/inactive |

**Response `200`:** Returns the updated rule object (same shape as POST response).

**Errors:**
- `400`: `id` missing; invalid `matchType`
- `404`: Rule not found; `categoryId` not found

---

### `DELETE /api/v1/rules`

Delete a rule (identified by `id` query parameter).

**Query parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | **Yes** | Rule ID to delete |

**Response `200`:** `{ "success": true }`

**Errors:**
- `400`: `id` query param missing
- `404`: Rule not found or not in workspace

---

### `PATCH /api/v1/rules/[id]`

Update a rule (alternative endpoint, identified by URL param).

Identical to `PATCH /api/v1/rules` but takes `id` from URL path instead of request body.

**Path parameters:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` (CUID) | Rule ID |

**Request body:** Same as `PATCH /api/v1/rules` (without `id`).

**Response `200`:** Updated rule object.

---

### `DELETE /api/v1/rules/[id]`

Delete a rule (alternative endpoint, identified by URL param).

**Path parameters:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` (CUID) | Rule ID |

**Response `200`:** `{ "success": true }`

---

## 8. Imports

Import transactions from CSV bank statements. Supports automatic format detection, deduplication, and categorization.

**Scope required:** `imports.create` (POST), `imports.delete` (DELETE)

### Supported CSV Formats

The importer auto-detects format by examining column headers. Supported formats:

| Bank | Detected columns |
|---|---|
| **Boursorama** | `date operation`, `libelle`, `montant` |
| **Revolut** | `started data`, `description`, `amount` |
| **BNP Paribas** | `dateope`, `libelle`, `montant` |
| **Credit Agricole** | `date de l'operation`, `libelle`, `montant` |

If no known format matches, the importer falls back to a generic parser that looks for columns matching: date, label, amount (or separate credit/debit columns).

### Deduplication

Each imported row generates a hash: `SHA256(dateOperation + amount + label)`. If a transaction with the same hash already exists in the workspace (unique constraint on `workspaceId + hash`), the row is skipped.

### Auto-Categorization During Import

Each row goes through the full categorization pipeline in order:
1. **Manual label decision**: Check `ManualLabelCategory` for `(labelNormalized, type)` pair
2. **Rules**: Iterate active rules sorted by priority, apply first matching rule
3. **Heuristic fallback**: 16 pattern groups (courses, transport, logement, sante, restaurants, abonnements, salaire, etc.)

### `POST /api/v1/imports`

Import a CSV file into a bank account.

**Request body:**

```json
{
  "fileContent": "date operation,libelle,montant\n2025-04-15,CARREFOUR MARKET,-42.50\n",
  "fileName": "compte_bnp_avril.csv",
  "bankAccountId": "ckvacc001..."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `fileContent` | `string` | **Yes** | Raw CSV content as a string |
| `fileName` | `string` | **Yes** | Original filename (for logging) |
| `bankAccountId` | `string` | **Yes** | Target bank account ID |

**Response `201`:**

```json
{
  "batchId": "ckvbatch001...",
  "success": true,
  "imported": 42,
  "skipped": 3,
  "errors": []
}
```

**Behavior:**
- Creates an `ImportBatch` record with status `PROCESSING`
- Processes each row: parses date/amount/label, deduplicates, categorizes
- Updates `ImportBatch` status to `COMPLETED` or `FAILED`
- `errorLog` stores up to 100 errors; response returns first 20

**Errors:**
- `400`: Missing fields; empty CSV; missing required columns
- `404`: `bankAccountId` not found or not in workspace

---

### `DELETE /api/v1/imports`

Delete an import batch and all its associated transactions.

**Query parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | **Yes** | Import batch ID |

**Response `200`:** `{ "success": true }`

**Behavior:**
- Deletes all `Transaction` records with `importBatchId` = this batch
- Deletes the `ImportBatch` record itself

**Errors:**
- `400`: `id` query param missing
- `404`: Import batch not found or not in workspace

---

## 9. Banks

### `GET /api/banks`

Public endpoint (no authentication) for searching supported EEA/UK banks. Data is sourced from a Google Sheets CSV cached for 24 hours.

**Query parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `q` | `string` | **Yes** | Search string (bank name or BIC), case-insensitive, diacritics-insensitive |

**Response `200`:**

```json
{
  "banks": [
    {
      "id": "BNP_PARIBAS_BNPAFRPPXXX",
      "name": "BNP Paribas",
      "bic": "BNPAFRPP",
      "countries": ["FR"],
      "logo": "https://x-public-data.gocardless.com/Logos/Original/BNP_PARIBAS_BNPAFRPPXXX.png"
    }
  ]
}
```

**Notes:**
- No authentication required
- `logo` is derived from the institution ID using the GoCardless logo CDN (`https://x-public-data.gocardless.com/Logos/Original/{id}.png`). Falls back to no image client-side if the URL is unavailable.
- This endpoint is used by the UI bank selector in the import flow
- Results are cached for 24 hours server-side

---

## 10. Data Models

### Entity Relationship Overview

```
Workspace (1) ──── (N) BankAccount
Workspace (1) ──── (N) Transaction
Workspace (1) ──── (N) Category
Workspace (1) ──── (N) CategorizationRule
Workspace (1) ──── (N) ManualLabelCategory
Workspace (1) ──── (N) ApiKey
Workspace (1) ──── (N) ImportBatch

BankAccount (1) ──── (N) Transaction
BankAccount (1) ──── (N) ImportBatch
Category (1) ──── (N) CategorizationRule
Category (1) ──── (N) Transaction
Category (1) ──── (N) Category (self-referential parent/child)
ImportBatch (1) ──── (N) Transaction
```

### Model: User

| Field | Type | Description |
|---|---|---|
| `id` | `string` (CUID) | Primary key |
| `email` | `string` (unique) | User email |
| `emailVerified` | `boolean` | Whether email is verified |
| `name` | `string?` | Display name |
| `image` | `string?` | Avatar URL |
| `createdAt` | `DateTime` | Account creation timestamp |

### Model: Workspace

| Field | Type | Description |
|---|---|---|
| `id` | `string` (CUID) | Primary key |
| `name` | `string` | Workspace display name |
| `slug` | `string` (unique) | URL-safe identifier |
| `type` | `WorkspaceType` | `PERSONAL`, `COUPLE`, or `FAMILY` |
| `defaultCurrency` | `string` | ISO 4217 currency code |

### Model: BankAccount

| Field | Type | Description |
|---|---|---|
| `id` | `string` (CUID) | Primary key |
| `workspaceId` | `string` | FK to Workspace |
| `ownerUserId` | `string?` | FK to User (who owns this account) |
| `name` | `string` | Display name |
| `type` | `AccountType` | `CHECKING`, `SAVINGS`, `CREDIT_CARD`, `INVESTMENT`, `OTHER` |
| `bankName` | `string?` | Bank name |
| `bankInstitutionId` | `string?` | GoCardless/Nordigen institution ID, used to resolve bank logo |
| `accountNumber` | `string?` | Account number (partial or full) |
| `referenceBalance` | `Decimal?` | Known balance at `referenceBalanceDate` |
| `referenceBalanceDate` | `DateTime?` | Date at which `referenceBalance` is accurate |
| `currency` | `string` | ISO 4217 currency code |
| `isActive` | `boolean` | Whether account is active |
| `createdAt` | `DateTime` | Creation timestamp |

### Model: Transaction

| Field | Type | Description |
|---|---|---|
| `id` | `string` (CUID) | Primary key |
| `importBatchId` | `string?` | FK to ImportBatch (if imported) |
| `workspaceId` | `string` | FK to Workspace |
| `bankAccountId` | `string` | FK to BankAccount |
| `ownerUserId` | `string?` | FK to User (who created/imported) |
| `dateOperation` | `DateTime` | Date of the transaction |
| `dateValue` | `DateTime?` | Value date (optional) |
| `label` | `string` | Original bank label |
| `labelNormalized` | `string?` | Lowercased, trimmed label |
| `merchant` | `string?` | Extracted merchant name |
| `amount` | `Decimal` | Transaction amount |
| `currency` | `string` | ISO 4217 currency code |
| `type` | `TransactionType` | `DEBIT`, `CREDIT`, `TRANSFER`, `FEE` |
| `isAutomatic` | `boolean` | Whether transaction is automatic debit |
| `categoryId` | `string?` | FK to Category |
| `categoryManual` | `string?` | Manual category assignment marker |
| `confidence` | `float` | Categorization confidence (0-1) |
| `hash` | `string` | Deduplication hash (unique per workspace) |
| `metadata` | `Json?` | Additional data (matched rule, original row) |
| `note` | `string?` | Free-text annotation (optional) |
| `pinned` | `boolean` | Whether the transaction is pinned (default: false) |
| `createdAt` | `DateTime` | Creation timestamp |

**Unique constraint:** `(workspaceId, hash)` — prevents duplicate imports.

### Model: Category

| Field | Type | Description |
|---|---|---|
| `id` | `string` (CUID) | Primary key |
| `workspaceId` | `string?` | FK to Workspace (null for system categories) |
| `name` | `string` | Display name |
| `slug` | `string` | URL-safe identifier (unique per workspace) |
| `description` | `string?` | Optional description |
| `color` | `string?` | Hex color code |
| `icon` | `string?` | Icon identifier |
| `isSystem` | `boolean` | True for pre-seeded categories (cannot delete) |
| `isIncome` | `boolean` | True if this is an income category |
| `parentId` | `string?` | FK to Category (self-referential for hierarchy) |

### Model: CategorizationRule

| Field | Type | Description |
|---|---|---|
| `id` | `string` (CUID) | Primary key |
| `workspaceId` | `string` | FK to Workspace |
| `name` | `string` | Rule name |
| `priority` | `integer` | Evaluation order (0 = highest) |
| `matchType` | `MatchType` | `EXACT`, `CONTAINS`, `STARTS_WITH`, `ENDS_WITH`, `REGEX`, `KEYWORD` |
| `pattern` | `string` | Pattern to match |
| `categoryId` | `string` | FK to Category |
| `isActive` | `boolean` | Whether the rule is active |
| `description` | `string?` | Optional description |

### Model: ManualLabelCategory

Maps a normalized label + transaction type to a specific category for automatic future categorization.

| Field | Type | Description |
|---|---|---|
| `id` | `string` (CUID) | Primary key |
| `workspaceId` | `string` | FK to Workspace |
| `labelNormalized` | `string` | Normalized label |
| `type` | `TransactionType` | Transaction type this mapping applies to |
| `categoryId` | `string` | FK to Category |
| `updatedAt` | `DateTime` | Last update timestamp |

**Unique constraint:** `(workspaceId, labelNormalized, type)`

### Model: ImportBatch

| Field | Type | Description |
|---|---|---|
| `id` | `string` (CUID) | Primary key |
| `workspaceId` | `string` | FK to Workspace |
| `createdByUserId` | `string` | FK to User who initiated import |
| `bankAccountId` | `string` | FK to BankAccount |
| `fileName` | `string` | Original filename |
| `originalName` | `string?` | Original file name |
| `formatDetected` | `string?` | Detected bank format name |
| `status` | `ImportStatus` | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` |
| `totalRows` | `integer` | Total rows in CSV |
| `importedCount` | `integer` | Successfully imported rows |
| `skippedCount` | `integer` | Skipped (duplicate) rows |
| `errorCount` | `integer` | Error rows count |
| `errorLog` | `Json?` | Array of error messages |

### Model: ApiKey

| Field | Type | Description |
|---|---|---|
| `id` | `string` (CUID) | Primary key |
| `userId` | `string` | FK to User who owns this key |
| `workspaceId` | `string` | FK to Workspace this key is scoped to |
| `name` | `string` | Human-readable key name |
| `prefix` | `string` | First 12 chars of key for lookup |
| `keyHash` | `string` | SHA-256 hash of the full key |
| `scopes` | `string[]` | Array of scope names |
| `isActive` | `boolean` | Whether the key is active |
| `expiresAt` | `DateTime?` | Optional expiration timestamp |
| `lastUsedAt` | `DateTime?` | Last usage timestamp |
| `createdAt` | `DateTime` | Creation timestamp |

---

## 11. Advanced Search & Filtering

### Transactions Filter Combinatorics

The `GET /api/v1/transactions` endpoint supports combining filters for precise queries:

**Date filtering priority:**
1. If `preset` is provided, it takes precedence and `from`/`to` are ignored
2. If `from` and/or `to` are provided, they define a custom range
3. If neither is provided, no date filter is applied (returns all)

**Examples:**

```
# Transactions from the last 7 days, sorted newest first
GET /api/v1/transactions?preset=last7d&sort=desc

# Transactions in a specific date range, newest first
GET /api/v1/transactions?from=2025-01-01&to=2025-03-31&sort=desc

# Transactions from January 2025 onwards (no end date)
GET /api/v1/transactions?from=2025-01-01&sort=asc

# Transactions from January 2025, limited to 10
GET /api/v1/transactions?from=2025-01-01&limit=10

# Uncategorized transactions from the current month
GET /api/v1/transactions?preset=month&category=uncategorized

# All transactions for a specific account, offset for pagination
GET /api/v1/transactions?account=ckvacc001...&offset=50&limit=50

# Search for transactions mentioning "carrefour"
GET /api/v1/transactions?q=carrefour

# Complex query: specific account + uncategorized + search term
GET /api/v1/transactions?account=ckvacc001...&category=uncategorized&q=amazon&limit=20
```

### Text Search Behavior

When `q` is provided, the query searches across three fields using `OR` logic:

- `label` (case-insensitive contains)
- `labelNormalized` (case-insensitive contains)
- `merchant` (case-insensitive contains)

Example: `q=netflix` would match:
- `"NETFLIX SARL"` in `label`
- `"netflix france"` in `labelNormalized`
- `"netflix"` in `merchant`

### Pagination

Pagination uses `offset`-based pagination (not cursor-based). To iterate through all pages:

1. Start with `offset=0&limit=50`
2. Check `hasMore: true` in response
3. If true, request `offset=50&limit=50`, repeat

The `total` count is returned in every response (useful for displaying total count without fetching all pages).

**Maximum page size:** 200. Requests above 200 are silently capped to 200.

### Sorting

Only `dateOperation` is sortable (no arbitrary field sorting). Default is `desc` (newest first).

---

## 12. Server Actions (Internal)

**For agents working on the UI only.** These are NOT REST endpoints and cannot be called via HTTP from external clients. They are Next.js Server Actions invoked from React components.

### Action: `updateTransactionCategory(transactionId, categoryId)`

Updates a single transaction's category and learns the manual label association.

**Parameters:**
- `transactionId: string` — Transaction ID
- `categoryId: string | null` — Category ID or null to uncategorize

**Side effects:** Same as `PATCH /api/v1/transactions/[id]` — creates/updates/deletes `ManualLabelCategory`.

**Authorization:** Session-based (not API key). Uses `getWorkspaceContext()`.

---

### Action: `bulkUpdateCategory(transactionIds, categoryId)`

Bulk updates multiple transactions' categories and learns manual label associations.

**Parameters:**
- `transactionIds: string[]` — Array of transaction IDs
- `categoryId: string | null` — Category ID or null

**Side effects:** Same as `POST /api/v1/transactions/bulk/category`.

**Authorization:** Session-based.

---

### Action: `deleteTransaction(transactionId)`

Deletes a single transaction.

**Parameters:**
- `transactionId: string` — Transaction ID

**Side effects:** Same as `DELETE /api/v1/transactions/[id]`.

**Authorization:** Session-based.

---

### Action: `createRuleFromTransaction(transactionId, categoryId)`

Creates a `KEYWORD` categorization rule from a transaction's label.

**Parameters:**
- `transactionId: string` — Source transaction ID
- `categoryId: string` — Target category ID

**Behavior:**
1. Fetches the transaction by ID
2. Extracts the normalized label
3. Creates a rule with `matchType: "KEYWORD"`, `pattern: labelNormalized`, `categoryId`

**Authorization:** Session-based.

**Use case:** Quickly promote a manual categorization decision into an automatic rule from the UI.

---

## Quick Reference

### Endpoints Summary

| Method | Path | Scope | Description |
|---|---|---|---|
| `GET` | `/api/v1/accounts` | `accounts.read` | List accounts |
| `POST` | `/api/v1/accounts` | `accounts.write` | Create account |
| `PATCH` | `/api/v1/accounts/[id]` | `accounts.write` | Update account |
| `DELETE` | `/api/v1/accounts/[id]` | `accounts.write` | Delete account |
| `GET` | `/api/v1/transactions` | `transactions.read` | List transactions |
| `GET` | `/api/v1/transactions/summary` | `summary.read` | Get summary totals |
| `PATCH` | `/api/v1/transactions/[id]` | `transactions.write` | Update category |
| `DELETE` | `/api/v1/transactions/[id]` | `transactions.write` | Delete transaction |
| `POST` | `/api/v1/transactions/bulk/category` | `transactions.write` | Bulk update category |
| `POST` | `/api/v1/categories` | `categories.write` | Create category |
| `PATCH` | `/api/v1/categories/[id]` | `categories.write` | Update category |
| `DELETE` | `/api/v1/categories/[id]` | `categories.write` | Delete category |
| `POST` | `/api/v1/rules` | `rules.write` | Create rule |
| `PATCH` | `/api/v1/rules` | `rules.write` | Update rule (by body id) |
| `DELETE` | `/api/v1/rules` | `rules.write` | Delete rule (by query id) |
| `PATCH` | `/api/v1/rules/[id]` | `rules.write` | Update rule (by URL id) |
| `DELETE` | `/api/v1/rules/[id]` | `rules.write` | Delete rule (by URL id) |
| `POST` | `/api/v1/imports` | `imports.create` | Import CSV |
| `DELETE` | `/api/v1/imports` | `imports.delete` | Delete import batch |
| `GET` | `/api/banks` | None | Search banks |

### Common cURL Examples

```bash
# List transactions
curl -X GET "https://your-domain.com/api/v1/transactions?preset=month&limit=10" \
  -H "Authorization: Bearer fk_your_api_key"

# Update transaction category
curl -X PATCH "https://your-domain.com/api/v1/transactions/ckvid123" \
  -H "Authorization: Bearer fk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"categoryId": "ckvcat001"}'

# Bulk categorize transactions
curl -X POST "https://your-domain.com/api/v1/transactions/bulk/category" \
  -H "Authorization: Bearer fk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"transactionIds": ["ckvid1", "ckvid2"], "categoryId": "ckvcat001"}'

# Create a categorization rule
curl -X POST "https://your-domain.com/api/v1/rules" \
  -H "Authorization: Bearer fk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"name": "Netflix", "pattern": "netflix", "matchType": "KEYWORD", "categoryId": "ckvcat001"}'

# Import CSV
curl -X POST "https://your-domain.com/api/v1/imports" \
  -H "Authorization: Bearer fk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"fileContent": "date,libelle,montant\n2025-04-15,NETFLIX,-15.99\n", "fileName": "avril.csv", "bankAccountId": "ckvacc001"}'
```
