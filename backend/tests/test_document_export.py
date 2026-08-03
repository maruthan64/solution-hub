from app.document_export import (
    _bold_to_reportlab,
    _esc,
    build_cost_estimate_markdown,
    markdown_to_docx,
    markdown_to_pdf,
    parse_monthly_price,
)


class TestParseMonthlyPrice:
    def test_simple_dollar_amount(self):
        assert parse_monthly_price("$500/mo") == 500.0

    def test_amount_with_thousands_comma(self):
        assert parse_monthly_price("$1,200/mo") == 1200.0

    def test_decimal_amount(self):
        assert parse_monthly_price("$99.99/mo") == 99.99

    def test_no_digits_returns_zero(self):
        assert parse_monthly_price("Contact us") == 0.0

    def test_empty_string_returns_zero(self):
        assert parse_monthly_price("") == 0.0


class TestBoldToReportlab:
    def test_wraps_bold_markers_in_b_tags(self):
        assert _bold_to_reportlab("**hello**") == "<b>hello</b>"

    def test_leaves_plain_text_untouched(self):
        assert _bold_to_reportlab("hello world") == "hello world"

    def test_escapes_html_special_chars_outside_bold(self):
        assert _bold_to_reportlab("a < b & c > d") == "a &lt; b &amp; c &gt; d"

    def test_mixed_bold_and_plain(self):
        assert _bold_to_reportlab("plain **bold** plain") == "plain <b>bold</b> plain"


class TestEsc:
    def test_escapes_ampersand_and_angle_brackets(self):
        assert _esc("<tag> & more") == "&lt;tag&gt; &amp; more"

    def test_plain_text_unaffected(self):
        assert _esc("just text") == "just text"


class TestMarkdownToDocx:
    def test_produces_nonempty_bytes(self):
        result = markdown_to_docx("Title", "# Heading\n\nSome **bold** text.")
        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_handles_table(self):
        content = "| Service | Qty |\n| --- | --- |\n| EC2 | 3 |"
        result = markdown_to_docx("Title", content)
        assert len(result) > 0

    def test_handles_empty_content(self):
        result = markdown_to_docx("Title", "")
        assert len(result) > 0

    def test_image_line_without_resolver_falls_back_to_text(self):
        # No resolve_image passed -> should not crash, just renders the line as text.
        result = markdown_to_docx("Title", "![Architecture Diagram](/api/documents/x/diagram/image)")
        assert len(result) > 0

    def test_image_line_with_resolver_embeds_picture(self):
        # 1x1 red PNG, smallest valid PNG payload.
        png_bytes = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
            b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0"
            b"\x00\x00\x03\x01\x01\x00\x18\xdd\x8d\xb0\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        result = markdown_to_docx(
            "Title",
            "![Architecture Diagram](/api/documents/x/diagram/image)",
            resolve_image=lambda url: png_bytes,
        )
        assert len(result) > 0


class TestBuildCostEstimateMarkdown:
    def test_computes_total_across_packages(self):
        packages = [
            {"id": "a", "name": "Basic", "tagline": "Entry tier", "monthlyPrice": "$500/mo", "resources": []},
            {"id": "b", "name": "Add-on", "tagline": "", "monthlyPrice": "$250.50/mo", "resources": []},
        ]
        md = build_cost_estimate_markdown(packages)
        assert "$750.50/mo" in md
        assert "## Basic" in md
        assert "## Add-on" in md

    def test_includes_resource_table_rows(self):
        packages = [
            {
                "id": "a",
                "name": "Basic",
                "tagline": "",
                "monthlyPrice": "$500/mo",
                "resources": [{"service": "EC2 t3.large", "quantity": 3, "purpose": "App servers"}],
            }
        ]
        md = build_cost_estimate_markdown(packages)
        assert "EC2 t3.large" in md
        assert "App servers" in md

    def test_empty_package_list_produces_zero_total(self):
        md = build_cost_estimate_markdown([])
        assert "$0.00/mo" in md


class TestMarkdownToPdf:
    def test_produces_nonempty_bytes(self):
        result = markdown_to_pdf("Title", "# Heading\n\nSome **bold** text.")
        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_handles_checkbox_list(self):
        result = markdown_to_pdf("Title", "- [x] Done\n- [ ] Not done")
        assert len(result) > 0

    def test_handles_code_block(self):
        result = markdown_to_pdf("Title", "```\nprint('hi')\n```")
        assert len(result) > 0
