# AirwallexDemo

Airwallex Payment Integration 


# HOW TO RUN

## Prequisites
1. Node JS v20.19.4
2. PostgresDB (PostgreSQL 18)
3. Use scanpay db (for mvp2)

## 1. Backend Node Server

```
git clone [repo]
cd backend
node server.js
```

## 2. Frontend NextJS

```
cd frontend
npm run dev
```



# A. Product View

## Core Idea

```
Customer scans QR → sees bill (includes "Convenience Fee" or "Platform Fee") + tipping selector → optionally splits → pays → POS updates + receipt prints
```

## ARCHITECTURE (SCALABLE)
```
Customer Phone (Web App)
        ↓
   Scan QR (table_id)
        ↓
   API Gateway
        ↓
┌──────────────────────────────┐
│  Scan-to-Pay Platform        │
│                              │
│  ├── Order Aggregator        │
│  ├── Payment Service         │
│  ├── Split Engine            │
│  ├── POS Adapter Layer       │
│  └── Notification Service    │
└──────────────────────────────┘
        ↓
   POS Systems (Raptor / Other POS)
        ↓
   Printer Service (Triggers)
```

## SCABALE POS ADAPTER LAYER
An abstraction layer that standardizes communication between the payment service app and any POS system
```
POS Adapter Interface
   ├── Raptor Adapter
   ├── SQL POS Adapter
   ├── Future POS Adapter
```

# B. USER FLOW (END-TO-END)

## 1. Scan QR

Each table has:

```
https://pay.raptordomain.com/table/T1?restaurant=R123
```

## 2. Fetch Bill
Fetch bill from POS Adaptor/ PostgressDB (Demo)

## 3. UI (Mobile Web App)
- Bill View
- Items list
- Total
- Split option
- Tip selector

## 4. Split Payment
Options:
- Equal split
- By item
- Custom amount

## 5. Add Tip

## 6. Payment
Uses:
- Airwallex
- Adyen

## 7. Success Flow

- Update order status
- Notify POS
- Trigger receipt print

# C. RECEIPT PRINTING
```
Payment success
    ↓
Send event → POS Adapter
    ↓
Call printer API
```

