"""Website audit scrape + scoring (httpx mocked)."""

from unittest.mock import MagicMock, patch

import httpx

from app.services import website_audit_service as svc


def _mock_response(html: str, url: str = "https://example.com/") -> MagicMock:
    resp = MagicMock()
    resp.url = url
    resp.status_code = 200
    resp.text = html
    return resp


def test_normalize_website_url_adds_https():
    assert svc.normalize_website_url("example.com").startswith("https://")


def test_normalize_rejects_localhost():
    try:
        svc.normalize_website_url("http://localhost/admin")
        raised = False
    except ValueError:
        raised = True
    assert raised


@patch("app.services.website_audit_service.httpx.Client")
def test_scrape_parses_title_and_meta(mock_client_cls):
    html = """
    <html><head>
    <title>Best Cars Beirut</title>
    <meta name="description" content="Rent cars in Lebanon.">
    </head><body><h1>Welcome</h1><p>Fleet and airport pickup daily.</p></body></html>
    """
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.get.return_value = _mock_response(html)
    mock_client_cls.return_value = mock_client

    with patch("app.services.website_audit_service.socket.create_connection"):
        with patch("app.services.website_audit_service.ssl.create_default_context") as mock_ctx:
            mock_ctx.return_value.wrap_socket.return_value.__enter__.return_value.getpeercert.return_value = {
                "subject": []
            }
            result = svc.scrape_website("https://example.com")

    assert result.title == "Best Cars Beirut"
    assert result.meta_description == "Rent cars in Lebanon."
    assert "Welcome" in result.h1s
    assert "Fleet" in result.text_snippet
    assert result.ssl_valid is True


@patch(
    "app.services.website_audit_service.normalize_website_url",
    return_value="https://autorent.example.com/",
)
@patch("app.services.website_audit_service._fetch_llm_insights", return_value=None)
@patch("app.services.website_audit_service.scrape_website")
def test_run_audit_mock_car_rental_keywords(mock_scrape, _mock_llm, _mock_norm):
    mock_scrape.return_value = svc.ScrapeResult(
        title="Gulf Drive",
        meta_description="Cars",
        h1s=["Rent now"],
        text_snippet="airport pickup fleet",
        response_time_ms=800,
        ssl_valid=True,
        final_url="https://autorent.example.com/",
    )
    out = svc.run_website_audit("https://autorent.example.com")
    assert 1 <= out.site_score <= 100
    assert out.ssl_status == "Valid"
    assert out.missing_keywords
    assert out.ad_recommendations
    assert "competitor" in out.competitor_insights.lower() or "airport" in out.competitor_insights.lower()


@patch("app.services.website_audit_service.httpx.Client")
def test_scrape_failure_returns_partial(mock_client_cls):
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.get.side_effect = httpx.TimeoutException("slow")
    mock_client_cls.return_value = mock_client

    result = svc.scrape_website("https://example.com")
    assert result.error is not None
    assert result.text_snippet == ""