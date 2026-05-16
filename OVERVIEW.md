SimplifIQ - AI Software Developer Intern Assessment
Thank you for your interest in SimplifIQ. We've reviewed your profile and would like to
move forward with a short technical assignment This assessment is designed to evaluate
practical ability, problem-solving approach, and readiness to work in modern AI-driven
software environments. We value clarity of thinking, execution capability, and responsible
use of AI tools.
General Instructions
• You may use AI tools, documentation, and references.
• Your submission must reflect your understanding and engineering decisions.
• Clearly document assumptions, tradeoffs, and limitations.
• Focus on clarity, maintainability, and practicality.
Problem Statement
Many businesses, especially in sectors like finance, consulting, SaaS, and B2B services rely
on lead intake forms to capture potential client information. However, the follow-up process
is often manual: teams research the company, prepare personalized insights, create audit
notes, and send outreach emails.
Your task is to build a working prototype that automates this entire workflow.
When a prospect submits a form containing their company details, the system should
automatically:
• Capture and validate the submitted lead information
• Enrich the company data using publicly available sources, scraping or APIs
• Generate a personalized audit/report document in PDF format
• Send the generated report to the prospect via email
• Complete the entire workflow without human intervention
The goal is to create a system that delivers a very highly personalized and professional first
interaction (super curated & align with their domain & work), demonstrating contextual
understanding of the prospect’s business immediately after form submission
What We’ll Be Looking At
• End-to-End Workflow
We’ll primarily evaluate how smoothly the complete automation flow works — from
lead submission and data enrichment to report generation and email delivery. A
functional and seamless workflow is the highest priority.
• Report Quality & Personalization
The generated report should feel professional, visually appealing, and personalized to
the company submitted. We want the final output to create a strong first impression
and clearly demonstrate meaningful research and insights.
• System Design & Problem Solving
We’ll look at how thoughtfully the solution handles real-world scenarios such as
missing data, failed API calls, scraping limitations, or incomplete company
information. Clean logic and sensible fallbacks matter.
• Code Quality & Documentation
Well-structured, readable, and maintainable code is important. Clear setup
instructions, architectural decisions, and concise documentation will help us
understand your approach and thought process.
BONUS
Sheets Logging: Append each new lead's data (name, email, company, timestamp, report
status) to a Google Sheet via the Sheets API. This acts as a live leads tracker.
PDF Archiving: Save a copy of the generated PDF to a Google Drive folder