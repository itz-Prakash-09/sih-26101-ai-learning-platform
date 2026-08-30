# SIH 26101 API Contract

## Base URL

http://localhost:8000

---

# 1. Generate Assessment

## POST

/api/assessment/generate

### Purpose

Generate competency questions from training material.

### Request

```json
{
  "material": "Training material text goes here"
}