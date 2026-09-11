# System Design & Flow

## Overview
The AI‑DM lead‑nurturing system is a **backend‑only** solution orchestrated by **n8n**.  It stores raw conversation messages, a mutable lead state, and a scalable list of intents in a PostgreSQL database accessed via Prisma.  The flow is entirely event‑driven – each inbound DM triggers a short‑lived workflow that classifies the conversation stage, selects the appropriate system prompt, generates a response, and updates the lead’s state.

---

## Components
| Component | Responsibility |
|---|---|
| **n8n Workflow Engine** | Orchestrates each step, calls external APIs, runs scheduled jobs. |
| **Webhook (Inbound DM)** | Entry point – receives a JSON payload from the social‑media platform (e.g., Instagram). |
| **PostgreSQL (via Prisma)** | Persists `Client`, `Lead`, `LeadState`, `Conversation`, `Intent`, and `StageTransition` tables. |
| **Stage Classifier Service** | Stateless LLM call that analyses recent messages + current state and returns JSON with `current_stage`, `stage_name`, `primary_intent`, `secondary_intents`, `should_advance`, etc. |
| **Prompt Library** | Markdown files (`stage_1_...md` … `stage_6_...md`) containing the system prompts you supplied, plus `global_rules.md`. |
| **Response Generator Service** | LLM call that receives the selected system prompt, recent conversation history, and a condensed lead‑state snapshot, and returns the DM text and optional state updates. |
| **DM Platform API** | Sends the generated reply back to the user (Instagram, LinkedIn, etc.). |
| **Scheduler / Cron Jobs** | Periodic cleanup of old conversation rows, analytics aggregation, optional archival. |

---

## Data Flow (Mermaid Diagram)
```mermaid
flowchart TD
    subgraph UserChannel[User Channel]
        A[Inbound DM] -->|Webhook| B[n8n: Receive DM]
    end

    B --> C[Store Message in `Conversation`]
    C --> D[Upsert Lead & Client (if new)]
    D --> E[Fetch LeadState]
    E --> F[Fetch recent N messages (e.g., 20)]
    F --> G[Stage Classifier (LLM)]
    G -->|JSON {stage, intent, should_advance}| H{Advance?}
    H -- Yes --> I[Update LeadState.stage, StageTransition]
    H -- No --> I[Keep current stage]
    I --> J[Load Prompt file (stage_{{stageName}}.md)]
    J --> K[Response Generator (LLM)]
    K --> L[Send DM via Platform API]
    L --> M[Store assistant message in `Conversation`]
    K --> N[Apply any `state_updates` to LeadState]
    N --> O[End of workflow]
    
    %% Periodic jobs (outside main flow)
    subgraph Scheduler[Scheduler]
        P[Cleanup old Conversation rows] --> Q[Archive / Delete]
    end
```

---

## Detailed Step‑by‑Step Walkthrough
1. **Inbound DM** – Platform posts a JSON payload to the n8n **Webhook** (`{leadId, clientId, message}`).
2. **Persist Message** – Insert a row into `Conversation` (`role='user'`).
3. **Lead/Client Upsert** – If the `leadId` does not exist, create a new `Client` (if needed) and a new `Lead` with a default `LeadState` (stage 1, intent UNKNOWN).
4. **Load State** – Retrieve the current `LeadState` row.
5. **Retrieve Recent History** – Query the latest *N* conversation rows (N ≈ 20) to keep the classifier payload small.
6. **Stage Classification** – Call the **Stage Classifier Service** (LLM) with:
   - System prompt (the classifier prompt you defined).
   - Recent messages + current `LeadState` fields.
   - The classifier returns JSON matching the schema you specified, e.g.:
     ```json
     {
       "current_stage": 2,
       "stage_name": "curiosity",
       "primary_intent": "WEALTH",
       "secondary_intents": ["TIME_FREEDOM"],
       "should_advance": true,
       "confidence": 0.92,
       "evidence": ["User mentioned freedom"],
       "stage_requirements_missing": []
     }
     ```
7. **Stage Advancement Decision** – If `should_advance` is `true` **and** the new stage is higher than the stored one, update `LeadState.stage`/`stage_name` and insert a row into `StageTransition`.
8. **Prompt Selection** – Read the appropriate markdown file from the **Prompt Library** based on the (possibly updated) `stage_name`. The file is concatenated with `global_rules.md` to form the system prompt.
9. **Response Generation** – Call the **Response Generator Service** (LLM) with:
   - System prompt (stage‑specific + global rules).
   - The recent conversation messages (both user and assistant).
   - A concise *state snapshot* (e.g., current intent, connection level, flags) to let the model ground its answer.
   - The LLM returns a JSON payload:
     ```json
     {"response": "...DM text...", "state_updates": {"quizOffered": true, "connectionLevel": "MEDIUM"}}
     ```
10. **Send DM** – Use an HTTP node to call the external platform API and deliver `response`.
11. **Persist Assistant Message** – Insert the assistant’s reply into `Conversation` (`role='assistant'`).
12. **Apply State Updates** – Merge `state_updates` into the `LeadState` row (flags, URLs, etc.).
13. **End of Workflow** – n8n finishes; the system waits for the next inbound DM.

---

## Supporting Jobs
- **Conversation Retention** – A cron job (e.g., nightly) runs a query: `DELETE FROM "Conversation" WHERE "createdAt" < now() - interval '12 months';` – adjust the interval when you decide on a retention policy.
- **Analytics & Reporting** – Periodically aggregate `StageTransition` data to monitor funnel conversion rates per client.
- **Intent Management UI (future)** – Since intents live in the `Intent` table, you can add a tiny admin endpoint to create, rename, or deactivate intents without schema changes.

---

## Scalability Considerations
- **Intent Table** – Adding a new intent is a simple `INSERT INTO Intent (name) VALUES ('NEW_INTENT');` – no migration needed.
- **Multi‑Client Isolation** – All tables reference `clientId` (through `Lead` → `Client`), allowing you to run a single DB instance for many customers while keeping data isolated.
- **Stateless LLM Calls** – Both classifier and response generator are stateless; they can be scaled horizontally behind an API gateway.
- **Caching** – Frequently used prompts can be cached in memory within n8n or a side‑car service to reduce disk I/O.

---

## Next Steps
1. **Create migration scripts** (`prisma migrate dev`) for the updated schema.
2. **Add the prompt markdown files** (`prompts/…md`) to the repository.
3. **Implement the n8n workflow** using the sketch above (exportable JSON).
4. **Set up the scheduled cleanup job** in n8n (cron trigger).
5. **Run an end‑to‑end test**: simulate a lead going through stages 1‑6 and verify `LeadState` and `StageTransition` records evolve as expected.

---

**Please review the flow and let me know if any component needs adjustment or if you’d like deeper detail on a particular step.**
