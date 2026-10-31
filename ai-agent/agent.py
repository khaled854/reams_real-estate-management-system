
import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from browser_use import Agent
from browser_use.llm import ChatAnthropic


# =========================================================
# ENVIRONMENT
# =========================================================

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"

load_dotenv(ENV_FILE)

REMS_URL = os.getenv(
    "REMS_URL",
    "http://localhost:5000"
).strip()

# =========================================================
# TEST ACCOUNTS
# =========================================================

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "").strip()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "").strip()

MANAGER_EMAIL = os.getenv("MANAGER_EMAIL", "").strip()
MANAGER_PASSWORD = os.getenv("MANAGER_PASSWORD", "").strip()

EMPLOYEE_EMAIL = os.getenv("EMPLOYEE_EMAIL", "").strip()
EMPLOYEE_PASSWORD = os.getenv("EMPLOYEE_PASSWORD", "").strip()

# =========================================================
# CLAUDE API
# =========================================================

ANTHROPIC_API_KEY = os.getenv(
    "ANTHROPIC_API_KEY",
    ""
).strip()


# =========================================================
# VALIDATION
# =========================================================

def validate_environment():

    required = {
        "ANTHROPIC_API_KEY": ANTHROPIC_API_KEY,

        "ADMIN_EMAIL": ADMIN_EMAIL,
        "ADMIN_PASSWORD": ADMIN_PASSWORD,

        "MANAGER_EMAIL": MANAGER_EMAIL,
        "MANAGER_PASSWORD": MANAGER_PASSWORD,

        "EMPLOYEE_EMAIL": EMPLOYEE_EMAIL,
        "EMPLOYEE_PASSWORD": EMPLOYEE_PASSWORD,
    }

    missing = [
        name
        for name, value in required.items()
        if not value
        or value.startswith("YOUR_")
        or value == "your_key_here"
    ]

    if missing:

        raise RuntimeError(
            "Missing environment variables: "
            + ", ".join(missing)
            + "\n\nCheck your .env file."
        )


# =========================================================
# TEST ACCOUNTS
# =========================================================

ACCOUNTS = [

    {
        "role": "ADMIN",
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
    },

    {
        "role": "MANAGER",
        "email": MANAGER_EMAIL,
        "password": MANAGER_PASSWORD,
    },

    {
        "role": "EMPLOYEE",
        "email": EMPLOYEE_EMAIL,
        "password": EMPLOYEE_PASSWORD,
    },

]


# =========================================================
# CREATE QA TASK
# =========================================================

def build_task(account):

    role = account["role"]
    email = account["email"]
    password = account["password"]

    return f"""

You are an autonomous senior QA engineer.

You are testing a LOCAL Real Estate Management System
called REMS.

==========================================================
APPLICATION
==========================================================

URL:

{REMS_URL}


==========================================================
TEST ACCOUNT
==========================================================

Role:

{role}

Email:

{email}

Password:

{password}

Use ONLY this account during this test run.


==========================================================
SAFETY RULES
==========================================================

This is an automated QA discovery test.

DO NOT:

- Delete existing records.
- Modify existing business records.
- Change passwords.
- Change users.
- Change roles.
- Change permissions.
- Change system settings.
- Send emails.
- Send WhatsApp messages.
- Perform destructive operations.
- Permanently modify business data.

You MAY:

- Navigate.
- Click.
- Search.
- Filter.
- Sort.
- Open details.
- Open menus.
- Open dialogs.
- Open forms.
- Inspect fields.
- Test pagination.
- Test tabs.
- Refresh pages.
- Navigate back and forward.
- Cancel forms.
- Inspect validation.

If an action would permanently create, update, or delete
business data, DO NOT SUBMIT IT.


==========================================================
PHASE 1 — LOGIN
==========================================================

1. Open the application.
2. Verify that it loads.
3. Find the login page.
4. Enter the email.
5. Enter the password.
6. Login.
7. Verify that authentication succeeds.
8. Verify that the correct dashboard loads.
9. Verify that the logged-in role appears correctly if visible.

If login fails:

- Record the exact error.
- Record the URL.
- Mark LOGIN as FAIL.
- Do not continue pretending that authentication succeeded.


==========================================================
PHASE 2 — DASHBOARD
==========================================================

After successful login:

Inspect the dashboard.

Check:

- Page loads.
- Dashboard cards.
- Statistics.
- Tables.
- Charts.
- Navigation.
- Buttons.
- Notifications.
- Loading states.
- Empty states.
- Error messages.

Do not assume data is correct unless it is visibly available.


==========================================================
PHASE 3 — MODULE DISCOVERY
==========================================================

Discover every module available to the {role} role.

Look for:

- Dashboard
- Properties
- Customers
- Clients
- Users
- Reports
- Settings
- Profile
- Notifications
- Sidebar items
- Header menus
- Tabs
- Buttons

Visit every page that is safely accessible.

Create an internal map:

Module
URL
Accessible: YES/NO
Loads: PASS/FAIL
Notes


==========================================================
PHASE 4 — NAVIGATION
==========================================================

For every accessible page:

1. Open it.
2. Verify the URL.
3. Verify page content.
4. Check for blank pages.
5. Check for broken components.
6. Check for infinite loading.
7. Refresh.
8. Navigate back.
9. Open it again.

Test:

- Sidebar navigation
- Header navigation
- Internal links
- Breadcrumbs
- Back button
- Refresh
- Buttons that navigate


==========================================================
PHASE 5 — SAFE FUNCTIONAL TESTING
==========================================================

Where safe, test:

- Search
- Filters
- Sorting
- Pagination
- Tabs
- Dropdowns
- Modals
- Close buttons
- Cancel buttons
- View details
- Expand/collapse

Do NOT save business changes.


==========================================================
PHASE 6 — FORMS
==========================================================

Open forms where possible.

Inspect:

- Required fields
- Email fields
- Number fields
- Date fields
- Dropdowns
- File upload
- Validation
- Error messages
- Disabled buttons
- Cancel behavior

You may test validation only when it does NOT permanently
modify business data.


==========================================================
PHASE 7 — ERROR DETECTION
==========================================================

Look carefully for:

- 400 errors
- 401 errors
- 403 errors
- 404 errors
- 500 errors
- API errors
- Authentication errors
- Authorization errors
- Broken images
- Broken links
- Blank pages
- Infinite loading
- Unexpected redirects
- Visible JavaScript errors
- Unexpected error messages


==========================================================
PHASE 8 — ROLE / ACCESS OBSERVATION
==========================================================

For the {role} account:

Check which modules are accessible.

Observe whether the UI exposes functionality that appears
inappropriate for this role.

DO NOT attempt privilege escalation.

DO NOT attempt to bypass authorization.

Simply record what is visibly accessible.


==========================================================
BUG REPORTING
==========================================================

For EVERY problem discovered record:

Bug title:
Module:
Role:
URL:
Severity:
Steps to reproduce:
Expected result:
Actual result:
Evidence:

Severity:

CRITICAL
HIGH
MEDIUM
LOW


==========================================================
FINAL REPORT
==========================================================

Generate:

REMS QA REPORT

Role tested:
Account:

LOGIN:
PASS / FAIL / BLOCKED

DASHBOARD:
PASS / FAIL / BLOCKED

PAGES DISCOVERED:

MODULES DISCOVERED:

FEATURES TESTED:

SUCCESSFUL CHECKS:

FAILED CHECKS:

BLOCKED CHECKS:

BUGS DISCOVERED:

For each bug:

- Title
- Severity
- Module
- URL
- Steps
- Expected
- Actual
- Evidence

ROLE / AUTHORIZATION OBSERVATIONS:

OVERALL STATUS:

HEALTHY
ISSUES FOUND
MAJOR ISSUES
BLOCKED


IMPORTANT:

Only report what you actually tested.

Never invent results.

Never claim that the whole application works unless it was
actually tested.

"""


# =========================================================
# RUN ONE ROLE
# =========================================================

async def run_role(llm, account):

    role = account["role"]

    print("\n" + "=" * 70)
    print(f"STARTING QA TEST — {role}")
    print("=" * 70)

    task = build_task(account)

    agent = Agent(
        task=task,
        llm=llm,
    )

    history = await agent.run()

    # =====================================================
    # SAVE REPORT
    # =====================================================

    report_dir = BASE_DIR / "reports"

    report_dir.mkdir(
        exist_ok=True
    )

    report_file = (
        report_dir
        / f"{role.lower()}-report.txt"
    )

    report_file.write_text(
        str(history),
        encoding="utf-8",
    )

    print("\n" + "=" * 70)
    print(f"{role} TEST FINISHED")
    print("=" * 70)

    print("\nReport saved to:")

    print(report_file)

    return history


# =========================================================
# MAIN
# =========================================================

async def main():

    # =====================================================
    # VALIDATE ENVIRONMENT
    # =====================================================

    validate_environment()

    print("=" * 70)
    print("REMS AI AUTONOMOUS QA")
    print("=" * 70)

    print(
        f"Application: {REMS_URL}"
    )

    print(
        "Accounts: ADMIN / MANAGER / EMPLOYEE"
    )

    print(
        "Claude: loaded"
    )

    print("=" * 70)


    # =====================================================
    # CLAUDE
    # =====================================================

    llm = ChatAnthropic(

        model="claude-sonnet-4-20250514",

        api_key=ANTHROPIC_API_KEY,

    )


    # =====================================================
    # RUN ALL ROLES
    # =====================================================

    results = {}


    for account in ACCOUNTS:

        try:

            results[
                account["role"]
            ] = await run_role(

                llm,

                account,

            )

        except Exception as error:

            print("\n" + "=" * 70)

            print(
                f"{account['role']} TEST ERROR"
            )

            print("=" * 70)

            print(error)

            results[
                account["role"]
            ] = (
                f"TEST ERROR:\n{error}"
            )


    # =====================================================
    # COMBINED REPORT
    # =====================================================

    report_dir = BASE_DIR / "reports"

    report_dir.mkdir(
        exist_ok=True
    )

    combined_report = (
        report_dir
        / "FULL-QA-REPORT.txt"
    )


    with combined_report.open(
        "w",
        encoding="utf-8",
    ) as file:

        file.write(

            "REMS FULL AI QA REPORT\n"

            + "=" * 70

            + "\n\n"

        )


        for role, result in results.items():

            file.write(

                "\n"

                + "=" * 70

                + "\n"

                + f"{role} REPORT\n"

                + "=" * 70

                + "\n\n"

            )

            file.write(
                str(result)
            )

            file.write(
                "\n\n"
            )


    # =====================================================
    # FINAL OUTPUT
    # =====================================================

    print("\n")

    print("=" * 70)

    print(
        "ALL REMS QA TESTS FINISHED"
    )

    print("=" * 70)

    print("\nReports:")


    for account in ACCOUNTS:

        print(

            report_dir

            / f"{account['role'].lower()}-report.txt"

        )


    print(
        combined_report
    )


# =========================================================
# ENTRY POINT
# =========================================================

if __name__ == "__main__":

    asyncio.run(main())

