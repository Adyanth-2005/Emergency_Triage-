# Architecture — ED Triage Console (P5)

## 1. System architecture

```mermaid
flowchart TB
  subgraph B["Browser — offline SPA"]
    R["hash router"] --> V["views: dashboard · board · triage · encounter · mlc · audit"]
    V --> C["console.css design tokens\n(3D aurora, tilt, 5 acuity colours)"]
    V --> AI["AIRecommendation card\nadvisory + Evidence Confidence"]
  end
  subgraph F["Flask app.py"]
    M2["FROZEN M2 API\nquick-reg · triage/suggest · triage · mlc · intimation · disposition"]
    M3["ADDITIVE M3 read models\nboard · encounters · encounter/:id · mlc · audit · scale · dashboard · attend · demo/reset"]
    E["triage_rules.evaluate()\nsuggests level + reasons"]
    A["audit() SHA-256 chain\n+ verify_chain()"]
  end
  DB[("SQLite (schema.sql)")]
  V -- JSON --> M2
  V -- JSON --> M3
  M2 --> E
  M2 --> A
  M2 --> DB
  M3 --> DB
  A --> DB
```

## 2. Database ERD

```mermaid
erDiagram
  PATIENT ||--o{ ED_ENCOUNTER : has
  ED_ENCOUNTER ||--o{ TRIAGE_EVENT : "assessed (re-triage capable)"
  ED_ENCOUNTER ||--o| MLC_CASE : "flagged as"
  MLC_CASE ||--o{ POLICE_INTIMATION : logs
  ED_ENCOUNTER ||--o| DISPOSITION : "ends in"
  TRIAGE_SCALE_CONFIG }o--|| TRIAGE_EVENT : "colours/labels"
  AUDIT_LOG }o--|| PATIENT : "records actions on"

  PATIENT { int id PK  string uhid  string temp_id  string name  int age_years  string sex  bool is_unknown  string reconciled_at  string created_at }
  ED_ENCOUNTER { int id PK  int patient_id FK  string arrival_ts  string arrival_mode  bool is_mlc  string status  string first_physician_at  string attended_by  string closed_ts }
  TRIAGE_EVENT { int id PK  int encounter_id FK  string chief_complaint  int hr  int spo2  int gcs  string red_flags_json  int suggested_level  int final_level  string override_reason  string triaged_by }
  MLC_CASE { int id PK  int encounter_id FK  string mlc_serial  int mlc_year  int mlc_seq  string mlc_type  bool pocso_flag  string opened_by }
  POLICE_INTIMATION { int id PK  int mlc_case_id FK  string intimated_ts  string police_station  string constable_name  string constable_badge  string mode }
  DISPOSITION { int id PK  int encounter_id FK  string type  string decided_by  bool mlc_warning_ack  string mlc_warning_reason }
  AUDIT_LOG { int id PK  string ts  string actor  string action  string entity  int entity_id  string prev_hash  string row_hash }
  TRIAGE_SCALE_CONFIG { int id PK  string scale_name  int level  string label  string colour  int max_wait_minutes  string criteria_json }
```

## 3. Core M3 workflow (arrival → disposition)

```mermaid
flowchart LR
  A["Quick registration\n(treat-first, temp ID)"] --> T["Triage\nengine SUGGESTS · nurse CONFIRMS"]
  T -->|status TRIAGED| BRD["Tracking board\n(acuity spine, breach)"]
  BRD --> AT["Physician attends\n(door-to-doctor stamp)"]
  AT --> MLC{"Medico-legal?"}
  MLC -->|yes| OM["Open MLC (gapless serial)"] --> INT["Log police intimation\n(BNSS §194-196)"]
  MLC -->|no| D
  INT --> D["Disposition"]
  D -->|MLC & no intimation| W["US-6 WARN (409)\nnever blocks — Art. 21"]
  W -->|ack + justification ≥10 chars| D2["Disposition saved"]
  D --> D2
  D2 -->|status CLOSED| END(["Encounter closed"])
```

## 4. Hybrid RAG pipeline (architected — see KNOWN_GAPS)

```mermaid
flowchart TB
  Q["Query"] --> QV["validate + intent"] --> RW["rewrite"]
  RW --> PR["parallel retrieval"]
  PR --> DEN["dense (local embeddings)"]
  PR --> SP["sparse (BM25)"]
  DEN --> RRF["Reciprocal Rank Fusion"]
  SP --> RRF
  RRF --> RR["cross-encoder rerank (optional)"] --> CC["context compression"]
  CC --> GEN["grounded LLM generation"] --> CIT["citation validation"] --> CF["Evidence Confidence"] --> GR["guardrails"] --> HC["human confirmation"]
```

_This pipeline is documented as the roadmap; the shipped console uses the deterministic,
already-explainable triage engine for its advisory cards rather than a fabricated LLM._

## 5. AI advisory workflow (what ships)

```mermaid
sequenceDiagram
  participant N as Nurse/Physician
  participant UI as Console
  participant API as Flask
  participant ENG as Rules engine
  participant DB as SQLite (audit chain)
  N->>UI: enter vitals / red flags
  UI->>API: POST /api/triage/suggest
  API->>ENG: evaluate()
  ENG-->>UI: level + reasons (ADVISORY)
  UI-->>N: AIRecommendation card + Evidence Confidence
  N->>UI: confirm / override (reason if differs)
  UI->>API: POST /api/triage (final_level)
  API->>ENG: recompute server-side (trust boundary)
  API->>DB: write triage + audit row (one transaction)
  DB-->>N: hash-chained, tamper-evident record
```
