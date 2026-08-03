# Chemical Inventory System

A simple but powerful web application to manage chemical inventory, stock levels, expiry dates, and Safety Data Sheets (SDS).

## Features

- Add, Edit, and Delete chemicals
- Search by name or CAS number
- Filters: All, Low Stock, Expiring Soon, Expired
- Sorting by Name, Quantity, or Expiry Date
- Upload and download SDS (PDF)
- Replace existing SDS files
- Low stock and expiry alerts
- Clean and modern interface

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** FastAPI (Python)
- **Database:** SQLite

## How to Run the Project

### 1. Backend

```bash
cd backend
source venv/bin/activate          # On Windows: venv\Scripts\activate
uvicorn app.main:app --reload