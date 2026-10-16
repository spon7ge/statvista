# Odds scrape

Language for capturing sportsbook quotes. Distinct from the live website’s MLB/WNBA product surface.

## Language

**Book**:
A sportsbook or exchange whose quotes we persist. This deepen is Novig; ProphetX and Pinnacle are other Books.
_Avoid_: sportsbook, vendor, source (when you mean the book itself)

**Odds Snapshot**:
A point-in-time capture of one Book’s player-prop and team-market quotes for one League.
_Avoid_: dump, scrape output, JSON (the files are an implementation of an Odds Snapshot)

**League** (odds scrape):
MLB, WNBA, or NFL as a scrape target for a Book.
_Avoid_: sport, competition (when you mean the scrape target)
