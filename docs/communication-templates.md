# Communication Templates & Safe Variable Engine

## Overview

ReceptionAI employs a declarative template system with safe string interpolation. Arbitrary executable code (e.g., `eval`, Pug, EJS, Python code execution) is strictly prohibited.

---

## Variable Syntax

Variables are marked with double curly braces:

```text
Hi {{customer_first_name}}, your appointment for {{service_name}} with {{business_name}} is confirmed for {{appointment_date}} at {{appointment_time}}. Reply STOP to opt out.
```

### Whitelisted Context Variables

| Variable Key | Source | Example Value |
|---|---|---|
| `customer_first_name` | Contact | "Sarah" |
| `customer_name` | Contact | "Sarah Connor" |
| `business_name` | Workspace Profile | "Apex Dental Studio" |
| `service_name` | Service Record | "Teeth Whitening" |
| `appointment_date` | Appointment Start | "Friday, Oct 24, 2026" |
| `appointment_time` | Appointment Start | "2:30 PM" |
| `notes` | Booking Notes | "First visit" |
| `reschedule_link` | System URL | "https://app.receptionai.com/..." |
| `cancel_link` | System URL | "https://app.receptionai.com/..." |

---

## Security & HTML Sanitization

For email templates containing HTML tags, the template engine passes rendered content through an HTML sanitizer to neutralize XSS vectors (`<script>`, `onerror`, `javascript:` protocol links).
