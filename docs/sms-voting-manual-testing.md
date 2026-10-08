# SMS voting: manual test script

Text each message to the program number from a phone that has an account.
Each `Send` block is one message; copy it as is. The messages use the
`columbus-dry-run-19afa414` decision; swap the slug when you test another
one.

Setup is in [Twilio configuration](twilio-configuration.md). The one
thing that bites: the inbound webhook must point at the **API host**
(`api-…`), not the app host.

## 1. See your decisions

Send:

```
DECISIONS
```

Expect one line per decision you can enter, `(voting open)` on the ones
taking votes:

```
Your decisions:
City of Columbus Participatory Budgeting - VOTE columbus
Commonville Participatory Budget - VOTE staging-commonville-pb-f2f67c2d
OVOC Dry Run - Feasibility Review 76860b55 - VOTE columbus-dry-run-76860b55
OVOC Dry Run - Idea Collection 19afa414 (voting open) - VOTE columbus-dry-run-19afa414
...
```

## 2. Open a decision on the web

Send:

```
SHOW columbus-dry-run-19afa414
```

Expect the name and a link that opens the decision:

```
OVOC Dry Run - Idea Collection 19afa414: https://<app host>/decisions/columbus-dry-run-19afa414
```

Send:

```
SHOW nope
```

Expect:

```
No decision named "nope" was found.
```

## 3. Browse proposals

Send:

```
PROPOSALS columbus-dry-run-19afa414
```

Expect five proposals with codes from `101`, then an offer of more:

```
"OVOC Dry Run - Idea Collection 19afa414" has 12 proposals. First 5:
101 Fifth Ave crosswalk lighting $85k
102 Linden rec center evening hours $240k
...
Reply MORE for the next ones, or INFO plus a code.
```

Send:

```
MORE
```

Expect the next page. The last page ends with
`Text a code to add it to your ballot, or INFO plus a code.`

Send:

```
INFO columbus-dry-run-19afa414 101
```

Expect the cost and summary of that proposal:

```
101: "Fifth Ave crosswalk lighting" ($85,000). Lights at the crossing. Text 101 to add it to your ballot.
```

## 4. Start a ballot

The decision must be in a voting phase. Set its **Max votes per member**
to 2 for this script.

Send:

```
VOTE columbus-dry-run-19afa414
```

Expect:

```
Voting is open for "OVOC Dry Run - Idea Collection 19afa414". You can pick up to 2 proposals. Text a code from your ballot guide to add your first pick, or PROPOSALS to browse.
```

If you get `Voting for "…" is not open.`, the decision is not in a voting
phase. If you get `"…" has no proposals to vote on.`, it has no submitted
proposals.

Everything below is a reply inside this ballot. Do not pause for more than
24 hours; the ballot expires.

## 5. Fill the ballot

Send:

```
LIST
```

Expect:

```
Your ballot is empty. Text a code to add a pick, or PROPOSALS to browse.
```

Send two picks in one message:

```
103 101
```

Expect both confirmed, in the order you texted:

```
Pick 1: "Neighborhood tree planting" ($150,000). Pick 2: "Fifth Ave crosswalk lighting" ($85,000). 0 picks left. Text another code, LIST to see your ballot, or DONE to review.
```

Send one more than the limit allows:

```
102
```

Expect:

```
You can pick 2. Reply REMOVE plus a code to make room.
```

Send:

```
REMOVE 103
```

Expect:

```
Removed "Neighborhood tree planting". 1 pick left. LIST shows your ballot.
```

Send a code that does not exist:

```
999
```

Expect:

```
No proposal with code 999.
```

Send:

```
102
```

Expect `Pick 2: "Linden rec center evening hours" ($240,000). 0 picks left. …`

Send:

```
DONE
```

Expect your ballot in pick order:

```
Your ballot for "OVOC Dry Run - Idea Collection 19afa414":
1. Fifth Ave crosswalk lighting $85,000
2. Linden rec center evening hours $240,000
Reply SUBMIT to cast your ballot, or REMOVE plus a code to change it.
```

## 6. Cast it

Send:

```
SUBMIT
```

Expect:

```
Your ballot is in. One ballot per person. How you vote is never public.
```

Check the web app: the decision's results and your "My ballot" show the
same two proposals.

## 7. Try to vote again

Send:

```
VOTE columbus-dry-run-19afa414
```

then:

```
101
```

then:

```
SUBMIT
```

Expect the welcome, a pick confirmation, then:

```
We could not record your ballot for "OVOC Dry Run - Idea Collection 19afa414".
```

The web app still shows one ballot.

## 8. A decision with one proposal

Use a voting decision that has exactly one submitted proposal.

Send:

```
VOTE <slug>
```

Expect:

```
Voting is open for "<name>". Reply YES to vote for "<title>" ($…).
```

Send:

```
YES
```

Expect:

```
Your ballot is in. One ballot per person. How you vote is never public.
```

## 9. The push when voting opens

Advance a decision with proposals into its voting phase from the web app.
Within about a minute, every member whose account has a phone and no email
receives the welcome from step 4, with no text sent. Members with an email
get the phase email and no text.

## 10. Messages that must get no reply

With no ballot in progress, send each of these and expect nothing back:

```
DONE
```

```
SUBMIT
```

```
MORE
```

```
101
```

```
PROPOSALS
```

## If nothing comes back

| Twilio shows                | Cause                                                            |
| --------------------------- | ---------------------------------------------------------------- |
| An HTML body, no status     | The webhook points at the app host. Use the `api-` host.         |
| `401`                       | `TWILIO_AUTH_TOKEN` is wrong, or the Console URL differs from the request URL. |
| `503`                       | `TWILIO_AUTH_TOKEN` is unset on the API deployment.              |
| `200` and no Inngest run    | Resync the Inngest app for this deployment.                      |

A run that ends with `sms sending unavailable` means
`TWILIO_MESSAGING_SERVICE_SID` is unset.
