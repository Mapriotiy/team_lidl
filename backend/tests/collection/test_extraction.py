from io import BytesIO

from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, StreamObject

from app.collection.extraction import extract


def pdf_with_text(text: str) -> bytes:
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    page[NameObject("/Resources")] = DictionaryObject(
        {
            NameObject("/Font"): DictionaryObject(
                {NameObject("/F1"): writer._add_object(font)}  # noqa: SLF001
            )
        }
    )
    content = StreamObject()
    content.set_data(f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode())
    page[NameObject("/Contents")] = writer._add_object(content)  # noqa: SLF001
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def test_extracts_text_from_pdf_report() -> None:
    result = extract(
        pdf_with_text("Annual report operational efficiency program"),
        "application/pdf",
    )

    assert result.text == "Annual report operational efficiency program"


def test_preserves_public_mailto_address_in_normalized_text() -> None:
    result = extract(
        b'<html><body><a href="mailto:ana.popescu@example.ro">Contact Ana</a></body></html>',
        "text/html; charset=utf-8",
    )

    assert "ana.popescu@example.ro" in result.text
