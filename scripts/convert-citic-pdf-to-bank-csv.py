#!/usr/bin/env python3
import csv
import re
import sys
from decimal import Decimal
from pathlib import Path

from pypdf import PdfReader


AMOUNT_RE = re.compile(r"RMB\s+[\d,]+\.\d{2}")


def money(value: str | None) -> Decimal:
    if not value:
        return Decimal("0")
    return Decimal(value.replace("RMB", "").replace(",", "").strip())


def split_tail(tail: str) -> tuple[str, str, str]:
    parts = tail.split()
    account_index = None
    for index, part in enumerate(parts):
        if re.fullmatch(r"\d{6,}", part):
            account_index = index
            break

    if account_index is None:
        return tail.strip(), "", ""

    summary = " ".join(parts[:account_index]).strip()
    counter_account = parts[account_index]
    counter_name = " ".join(parts[account_index + 1 :]).strip()
    return summary, counter_account, counter_name


def extract_rows(pdf_path: Path) -> list[dict[str, str]]:
    reader = PdfReader(str(pdf_path))
    raw_rows = []

    for page in reader.pages:
        text = page.extract_text(extraction_mode="layout") or ""
        for line in text.splitlines():
            if not re.match(r"\s*\d{8}\s+", line):
                continue

            date_match = re.match(r"^\s*(\d{8})\s+", line)
            amounts = list(AMOUNT_RE.finditer(line))
            if not date_match or len(amounts) < 2:
                raise ValueError(f"无法解析交易行: {line!r}")

            transaction_amount_match = amounts[-2]
            balance_match = amounts[-1]
            transaction_amount = money(transaction_amount_match.group())

            # In layout text, income appears in the left amount column and expense
            # appears in the right amount column before the balance column.
            is_income = transaction_amount_match.start() < 30
            tail = line[balance_match.end() :].strip()
            summary, counter_account, counter_name = split_tail(tail)
            raw_rows.append(
                {
                    "date": date_match.group(1),
                    "income": transaction_amount if is_income else Decimal("0"),
                    "expense": Decimal("0") if is_income else transaction_amount,
                    "balance": money(balance_match.group()),
                    "summary": summary,
                    "counter_account": counter_account,
                    "counter_name": counter_name,
                    "source_line": line,
                }
            )

    rows = []
    mismatches = []
    for index, row in enumerate(raw_rows):
        income = row["income"]
        expense = row["expense"]

        if income and expense:
            mismatches.append((index + 1, "同时存在收入和支出", row["source_line"]))
        elif not income and not expense:
            mismatches.append((index + 1, "缺少收入/支出金额", row["source_line"]))

        if index > 0:
            expected_delta = income - expense
            actual_delta = row["balance"] - raw_rows[index - 1]["balance"]
            if abs(expected_delta - actual_delta) > Decimal("0.01"):
                mismatches.append(
                    (
                        index + 1,
                        f"余额变化不匹配: expected {expected_delta}, actual {actual_delta}",
                        row["source_line"],
                    )
                )

        rows.append(
            {
                "交易日期": row["date"],
                "收入金额": "" if income == 0 else f"{income:.2f}",
                "支出金额": "" if expense == 0 else f"{expense:.2f}",
                "交易摘要": row["summary"],
                "对方账号": row["counter_account"],
                "对方户名": row["counter_name"],
            }
        )

    if mismatches:
        preview = "\n".join(f"{number}: {reason} | {line}" for number, reason, line in mismatches[:10])
        raise ValueError(f"交易校验失败，共 {len(mismatches)} 条异常:\n{preview}")

    return rows


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: convert-citic-pdf-to-bank-csv.py <input.pdf> <output.csv>", file=sys.stderr)
        return 2

    pdf_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    rows = extract_rows(pdf_path)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=["交易日期", "收入金额", "支出金额", "交易摘要", "对方账号", "对方户名"],
        )
        writer.writeheader()
        writer.writerows(rows)

    income_total = sum(Decimal(row["收入金额"] or "0") for row in rows)
    expense_total = sum(Decimal(row["支出金额"] or "0") for row in rows)
    print(f"rows={len(rows)} income_total={income_total:.2f} expense_total={expense_total:.2f}")
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
