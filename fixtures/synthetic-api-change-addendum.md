# Fictional API Data Change Addendum

**Synthetic demo document - not a real contract - no legal effect**

Agreement ID: CT-DEMO-204
Effective date: August 18, 2026
Parties: Northstar API Labs (Provider) and Fiction Retail (Customer)

## 1. Change notice

Provider proposes to replace the response field `shipping_country` with `country_code` in the Orders API. The change affects the production Orders API, the Fulfillment Analytics feed, and the Revenue Export interface.

## 2. Compatibility window

Provider will keep both `shipping_country` and `country_code` readable for 45 calendar days after Customer confirms receipt of the migration notice. The legacy field must not be removed before the compatibility window ends.

## 3. Notice and approval

Provider must deliver a written notice at least 14 calendar days before enabling `country_code` in production. The Customer Data Platform Owner must record approval before the legacy field is removed.

## 4. Retention and logs

Migration evidence may contain field names, timestamps, and synthetic request identifiers. It must not contain customer payload values. Evidence packets must be retained for 90 days and then deleted under the parties' normal retention process.

## 5. Rollback

The production change must have a tested rollback that restores the previous response shape within 30 minutes. If error rate increases by more than two percentage points during the first hour, Provider must pause the rollout and execute the rollback plan.

## 6. Prohibited actions

The parties must not remove `shipping_country`, publish customer payload values, or bypass the recorded approval while a required review item is unresolved.

## 7. Ambiguous term for review

The phrase “Customer confirms receipt” is not defined in this addendum. The reviewer must identify an approval channel before calculating the final removal date.
