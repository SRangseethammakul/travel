# Travel Planner

A mobile-first app for group trips: collect places, plan days, record expenses, split costs and settle up.

## Language

### People

**Member**:
A named participant in one **Trip**, with a role (owner, editor, viewer). A Member may exist before any real person has an account linked to it.
_Avoid_: User, participant, friend

**User**:
A real person's account, signed in via LINE or Google. One User can be a **Member** of many Trips.
_Avoid_: Account, member

**Unclaimed Member**:
A **Member** added by someone else that no **User** has linked to yet; expenses can already be recorded in its name.
_Avoid_: Guest, placeholder

**Claim**:
The act of a **User** joining via invite and choosing which **Unclaimed Member** they are, taking over everything recorded in that name.
_Avoid_: Merge, link

**Current Member**:
The **Member** that the signed-in **User** is in the Trip being viewed — the "คุณ" in the UI. Every per-person figure ("my balance", "you owe") is computed from it, never hard-coded.
_Avoid_: Me, self

### Money

**Expense**:
One purchase paid by one **Member** (the payer) and split among some Members as **Shares**.
_Avoid_: Bill, transaction, payment

**Share**:
The portion of one **Expense** a given **Member** is responsible for. All Shares of an Expense sum exactly to its amount.
_Avoid_: Split, portion

**Net Balance**:
What a **Member** paid minus the sum of their **Shares**, across all Expenses in the Trip. Positive means they are owed money. Not affected by **Settlements**.
_Avoid_: Balance, total

**Outstanding**:
A **Member**'s **Net Balance** after subtracting **Settlements** that are confirmed. Zero means the Member is fully settled. Settlements that are only sent do not count yet.
_Avoid_: Balance, remaining, debt

**Settlement**:
A real money transfer from one **Member** to another to pay down **Outstanding**. It is pending until sent, sent until the receiver confirms it, and only then confirmed.
_Avoid_: Payment, repayment, transfer

**Suggested Transfer**:
A transfer the system proposes, computed from **Outstanding** so the group needs as few transfers as possible. It becomes a **Settlement** once someone acts on it.
_Avoid_: Debt, settlement

### Places and plans

**Place**:
An entry in a Trip's shared library of places someone wants to visit, filed under a city and an **Area**. A Place is not tied to a day.
_Avoid_: Spot, location, activity

**Area**:
A neighbourhood within a city that a **Member** types in themselves, e.g. Shinjuku. It is the main way Places are grouped.
_Avoid_: District, zone, ย่าน as a free label

**Tag**:
A label owned by one **User** that they can reuse across all their Trips and arrange into groups. Once a Tag is on a **Place**, every **Member** of that Trip can see it, but only its owner can rename, regroup or delete it.
_Avoid_: Category, label

**Plan Item**:
One entry on a day's timeline, either a visit to a **Place** at a time or a booked **Transit**. The same Place can appear in many Plan Items.
_Avoid_: Activity, event, schedule

**Transit**:
A booked journey with fixed times, e.g. a flight from BKK to HND. It appears as its own **Plan Item** and can link to documents and an **Expense**.
_Avoid_: Trip, flight, booking

**Hop**:
How people get from one Place **Plan Item** to the next on the same day, e.g. a 15-minute walk. It belongs to the earlier Plan Item and is not booked.
_Avoid_: Leg, transfer, route

**City Leg**:
One part of a multi-city Trip's route: a city plus the range of days spent there, e.g. Kyoto on days 5–6.
_Avoid_: Leg alone, stop, route

**Unscheduled Place**:
A **Place** that has no **Plan Item** yet ("ยังไม่จัดวัน").
_Avoid_: Backlog, unplanned

## Example dialogue

> **Dev:** On the Settle Up screen, who is "คุณ"?
> **Domain expert:** The **Current Member** — whoever is signed in. If Ploy is signed in, she sees what she owes Act and can attach a slip.
> **Dev:** And before Beam joins, can expenses still be split with him?
> **Domain expert:** Yes, Beam is an **Unclaimed Member**. When he opens the invite and **Claims** "Beam", those shares become his.
> **Dev:** Act's **Net Balance** is +฿14,050 and Mint already paid him ฿3,100. What does Act's trip card show?
> **Domain expert:** His **Outstanding**: +฿10,950. The Summary table still shows the **Net Balance** of +฿14,050, because that comes from expenses only.
> **Dev:** And if Beam marked his ฿5,800 as sent but Act hasn't confirmed it?
> **Domain expert:** Still counts toward Outstanding. The **Settlement** shows "รอยืนยัน" until Act confirms.
