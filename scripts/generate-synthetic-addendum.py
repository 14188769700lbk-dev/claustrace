from __future__ import annotations

from pathlib import Path

from reportlab import rl_config
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


rl_config.invariant = 1


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "synthetic-api-change-addendum.pdf"

INK = colors.HexColor("#17231F")
MUTED = colors.HexColor("#66736D")
TEAL = colors.HexColor("#1E8A72")
TEAL_SOFT = colors.HexColor("#E8F6F1")
CORAL = colors.HexColor("#F16F61")
CORAL_SOFT = colors.HexColor("#FFF0ED")
LINE = colors.HexColor("#D7E2DC")
WHITE = colors.white


def styles():
    base = getSampleStyleSheet()
    base.add(
        ParagraphStyle(
            name="DocTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=24,
            textColor=INK,
            spaceAfter=4 * mm,
        )
    )
    base.add(
        ParagraphStyle(
            name="Section",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11.2,
            leading=13.5,
            textColor=INK,
            spaceBefore=2.5 * mm,
            spaceAfter=1.2 * mm,
        )
    )
    base.add(
        ParagraphStyle(
            name="BodyDoc",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.9,
            leading=12.5,
            textColor=INK,
            spaceAfter=1.7 * mm,
        )
    )
    base.add(
        ParagraphStyle(
            name="Banner",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            alignment=TA_CENTER,
            textColor=CORAL,
        )
    )
    base.add(
        ParagraphStyle(
            name="SmallDoc",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7.5,
            leading=10,
            textColor=MUTED,
        )
    )
    return base


S = styles()


def p(text: str, style: str = "BodyDoc") -> Paragraph:
    return Paragraph(text, S[style])


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(INK)
    canvas.rect(0, height - 15 * mm, width, 15 * mm, stroke=0, fill=1)
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(20 * mm, height - 9.5 * mm, "ClauseTrace")
    canvas.setFillColor(colors.HexColor("#8EDCC4"))
    canvas.setFont("Helvetica", 7.5)
    canvas.drawRightString(width - 20 * mm, height - 9.5 * mm, "SYNTHETIC DOCUMENT - CT-DEMO-204")
    canvas.setStrokeColor(LINE)
    canvas.line(20 * mm, 14 * mm, width - 20 * mm, 14 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(20 * mm, 9 * mm, "Fictional API Data Change Addendum - no legal effect")
    canvas.drawRightString(width - 20 * mm, 9 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_story():
    story = [Spacer(1, 6 * mm)]
    story.append(p("Fictional API Data Change Addendum", "DocTitle"))
    story.append(
        Table(
            [[p("SYNTHETIC DEMO DOCUMENT - NOT A REAL CONTRACT - NO LEGAL EFFECT", "Banner")]],
            colWidths=[166 * mm],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), CORAL_SOFT),
                    ("BOX", (0, 0), (-1, -1), 0.7, CORAL),
                    ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
                ]
            ),
        )
    )
    story.append(Spacer(1, 3 * mm))
    meta = [
        ["Agreement ID", "CT-DEMO-204"],
        ["Effective date", "August 18, 2026"],
        ["Parties", "Northstar API Labs (Provider) and Fiction Retail (Customer)"],
    ]
    story.append(
        Table(
            [[p(f"<b>{key}</b>"), p(value)] for key, value in meta],
            colWidths=[34 * mm, 132 * mm],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, -1), TEAL_SOFT),
                    ("GRID", (0, 0), (-1, -1), 0.4, LINE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
                    ("TOPPADDING", (0, 0), (-1, -1), 1.6 * mm),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 1.6 * mm),
                ]
            ),
        )
    )

    sections = [
        (
            "1. Change notice",
            "Provider proposes to replace the response field <b>shipping_country</b> with <b>country_code</b> in the Orders API. The change affects the production Orders API, the Fulfillment Analytics feed, and the Revenue Export interface.",
        ),
        (
            "2. Compatibility window",
            "Provider will keep both <b>shipping_country</b> and <b>country_code</b> readable for <b>45 calendar days</b> after Customer confirms receipt of the migration notice. The legacy field must not be removed before the compatibility window ends.",
        ),
        (
            "3. Notice and approval",
            "Provider must deliver a written notice at least <b>14 calendar days</b> before enabling <b>country_code</b> in production. The <b>Customer Data Platform Owner</b> must record approval before the legacy field is removed.",
        ),
        (
            "4. Retention and logs",
            "Migration evidence may contain field names, timestamps, and synthetic request identifiers. It must not contain customer payload values. Evidence packets must be retained for <b>90 days</b> and then deleted under the parties' normal retention process.",
        ),
        (
            "5. Rollback",
            "The production change must have a tested rollback that restores the previous response shape within <b>30 minutes</b>. If error rate increases by more than two percentage points during the first hour, Provider must pause the rollout and execute the rollback plan.",
        ),
        (
            "6. Prohibited actions",
            "The parties must not remove <b>shipping_country</b>, publish customer payload values, or bypass the recorded approval while a required review item is unresolved.",
        ),
        (
            "7. Ambiguous term for review",
            "The phrase <b>Customer confirms receipt</b> is not defined in this addendum. The reviewer must identify an approval channel before calculating the final removal date.",
        ),
    ]
    for heading, body in sections:
        story.append(p(heading, "Section"))
        story.append(p(body))

    story.append(Spacer(1, 1.5 * mm))
    story.append(
        Table(
            [[p("ClauseTrace demo boundary", "Section"), p("This document exists only to test cited extraction, current-source discovery, human review, engineering-control mapping, and evidence-packet generation. It creates no rights or obligations.")]],
            colWidths=[48 * mm, 118 * mm],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), TEAL_SOFT),
                    ("BOX", (0, 0), (-1, -1), 0.7, TEAL),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
                    ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
                ]
            ),
        )
    )
    return story


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=22 * mm,
        leftMargin=22 * mm,
        topMargin=24 * mm,
        bottomMargin=18 * mm,
        title="ClauseTrace fictional API data change addendum",
        author="ClauseTrace",
        subject="Synthetic document for cited extraction and human review",
    )
    doc.build(build_story(), onFirstPage=header_footer, onLaterPages=header_footer)
    print(OUTPUT)


if __name__ == "__main__":
    main()
