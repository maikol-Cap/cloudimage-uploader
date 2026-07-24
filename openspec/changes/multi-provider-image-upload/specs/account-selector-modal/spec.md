# Account Selector Modal Specification

## Purpose

Defines how the UploadModal presents an account selector dropdown so the user can choose which configured account to upload to. Covers default selection, persistence of the last-used account, visibility rules, and the integration with the provider-based upload flow.

## Requirements

### Requirement: Dropdown Rendering in Upload Modal

The UploadModal MUST render an account selector dropdown when two or more accounts are configured. The dropdown SHALL be populated from `settings.accounts` and sorted alphabetically by account name.

#### Scenario: Dropdown with multiple accounts

- GIVEN accounts "B2 Backup", "ImgBB Personal", and "R2 Work" exist
- WHEN the UploadModal opens
- THEN a dropdown labeled "Account:" is visible
- AND the options are listed in alphabetical order: "B2 Backup", "ImgBB Personal", "R2 Work"

#### Scenario: Dropdown includes provider type indicator

- GIVEN the dropdown renders multiple accounts
- WHEN the user looks at an option
- THEN each option shows the account name alongside a provider badge or label (e.g., "ImgBB Personal [ImgBB]")

### Requirement: Default Selection — lastUsedAccountId

When the UploadModal opens, the system MUST pre-select the account matching `settings.lastUsedAccountId`. If `lastUsedAccountId` is `null` or the referenced account no longer exists, the system SHALL fall back to the first account in the list.

#### Scenario: Last used account is pre-selected

- GIVEN `lastUsedAccountId` is `"def-456"`
- AND account `"def-456"` (named "R2 Work") exists
- WHEN the UploadModal opens
- THEN "R2 Work" is the selected option in the dropdown

#### Scenario: lastUsedAccountId is null — first account selected

- GIVEN `lastUsedAccountId` is `null`
- AND accounts "ImgBB Personal" and "R2 Work" exist
- WHEN the UploadModal opens
- THEN "ImgBB Personal" (first alphabetically) is selected

#### Scenario: Referenced account was deleted — first account selected

- GIVEN `lastUsedAccountId` is `"deleted-account-id"`
- AND account `"deleted-account-id"` no longer exists in `settings.accounts`
- AND account "R2 Work" exists
- WHEN the UploadModal opens
- THEN "R2 Work" is selected

### Requirement: On Change — Persist lastUsedAccountId

When the user selects a different account from the dropdown, the system MUST update `settings.lastUsedAccountId` to the selected account's `id` and persist the settings immediately.

#### Scenario: User switches account

- GIVEN "ImgBB Personal" is currently selected
- WHEN the user selects "B2 Backup" from the dropdown
- THEN `settings.lastUsedAccountId` is set to the B2 account's `id`
- AND `saveData(settings)` is called

#### Scenario: Selection unchanged

- GIVEN "R2 Work" is selected
- WHEN the user opens the dropdown and clicks "R2 Work" again
- THEN no settings write occurs (the value is unchanged)

### Requirement: Hidden When 0 or 1 Accounts

The account selector dropdown SHALL be hidden when zero or one accounts are configured. The upload SHALL proceed with the single account when exactly one exists.

#### Scenario: Hidden with zero accounts

- GIVEN no accounts are configured
- WHEN the UploadModal opens
- THEN no account selector dropdown is visible

#### Scenario: Hidden with one account

- GIVEN exactly one account ("ImgBB Personal") is configured
- WHEN the UploadModal opens
- THEN no account selector dropdown is visible
- AND uploads automatically use that single account

#### Scenario: Visible with two accounts

- GIVEN two accounts are configured
- WHEN the UploadModal opens
- THEN the account selector dropdown is visible

### Requirement: Upload Integration — Account → Provider → Upload

When the user triggers an upload, the system MUST resolve the selected account, look up its provider from the `ProviderRegistry`, and call `provider.upload(file, credentials, name?)`. The credentials passed to the provider SHALL be the account's own credential fields.

#### Scenario: Upload uses selected account's provider

- GIVEN "R2 Work" is selected in the dropdown
- AND the user drags a file onto the modal and clicks Upload
- WHEN the upload is triggered
- THEN the system resolves the R2 account from `settings.accounts`
- AND `registry.get("r2")` returns the `R2Provider`
- AND `r2Provider.upload(file, r2Credentials)` is called

#### Scenario: Upload with no accounts configured

- GIVEN no accounts exist
- AND the user attempts to upload
- WHEN the upload is triggered
- THEN an error message is displayed
- AND the message directs the user to configure an account in settings

### Requirement: Upload Error — Account Resolution Failure

If the selected account's provider cannot be found in the registry (e.g., the provider is not registered), the system MUST display an error Notice and SHALL NOT attempt the upload.

#### Scenario: Provider not registered

- GIVEN an account with `provider: "b2"` is selected
- AND the `ProviderRegistry` does not have a B2 provider registered
- WHEN an upload is attempted
- THEN an error Notice is displayed (e.g., "Upload failed: provider 'b2' is not available.")
- AND no HTTP request is sent

### Requirement: Visual Integration with Modal Layout

The account selector dropdown MUST be positioned in the modal toolbar area, alongside existing controls (such as the image-size selector, if present). It SHALL NOT interfere with the drop zone or file preview area.

#### Scenario: Dropdown in toolbar

- GIVEN the UploadModal renders with an image-size toolbar
- WHEN the account selector is visible
- THEN it appears in the same toolbar row as the image-size controls
- AND the drop zone remains fully functional

### Requirement: No Flicker on Open

When the UploadModal opens, the correct account SHALL be selected before the dropdown is visible to the user. The system SHALL NOT show a brief intermediate state (e.g., "no account selected" or wrong account).

#### Scenario: Pre-selection before paint

- GIVEN `lastUsedAccountId` points to "R2 Work"
- WHEN the UploadModal DOM is constructed in `onOpen()`
- THEN the `"R2 Work"` option is set as the dropdown's value before it is shown
- AND the user never sees an unselected state
