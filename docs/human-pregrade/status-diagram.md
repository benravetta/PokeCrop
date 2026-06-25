# Status transitions

```text
draft → awaiting_payment → paid → awaiting_submission | submitted
awaiting_submission → submitted → queued → assigned → under_review
under_review ↔ awaiting_customer_images ↔ customer_images_received
under_review → report_drafting → quality_check → completed | under_review
under_review | awaiting_customer_images → unable_to_assess
* → cancelled → refunded (from cancelled | unable_to_assess)
```

Customer-facing labels are mapped in `domain/customerStatus.ts`.
