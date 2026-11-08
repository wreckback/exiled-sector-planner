# Later

Ideas noted for a future pass. Not built yet.

- **Ship tab: hover explanations for each setting.** Add a tooltip (`title` or a small hover box) per row in `#panel-ship` saying what the setting means and which nodes it affects. For example:
  - **Only built-in fighter wings:** the hull has at least one built-in wing and every fighter bay is taken by built-in wings (`ShipFacts.onlyBuiltInWings`: `builtInWings > 0 && fighterBays <= builtInWings`, e.g. a Tempest). It only affects Converted Fighter Bay (`REMOVE_ALL_FIGHTER_BAYS`), which needs "Yes".
  - Do the same for shield, base armor, civilian-grade hull, system charges and station modules.
