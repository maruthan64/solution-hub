class TestSearch:
    def test_requires_auth(self, client):
        resp = client.get("/api/search?q=test")
        assert resp.status_code == 401

    def test_short_query_returns_empty(self, auth_client):
        resp = auth_client.get("/api/search?q=a")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_finds_capability_by_name(self, auth_client):
        auth_client.post(
            "/api/capabilities",
            json={"name": "AWS Contact Center", "cloud": "AWS", "description": "", "keyServices": []},
        )
        resp = auth_client.get("/api/search?q=contact")
        assert resp.status_code == 200
        results = resp.json()
        matches = [r for r in results if r["type"] == "capability"]
        assert any(m["title"] == "AWS Contact Center" for m in matches)
        assert matches[0]["url"] == "/capabilities"

    def test_finds_service_package_by_tagline(self, auth_client):
        auth_client.post(
            "/api/service-catalog",
            json={
                "category": "tier",
                "name": "Basic Tier",
                "tagline": "Small workloads, easy start",
                "monthlyPrice": "$500/mo",
            },
        )
        resp = auth_client.get("/api/search?q=easy start")
        matches = [r for r in resp.json() if r["type"] == "service_package"]
        assert any(m["title"] == "Basic Tier" for m in matches)

    def test_finds_solution_package_by_name(self, auth_client):
        auth_client.post("/api/solution-packages", json={"name": "SAP on AWS Migration", "cloud": "AWS"})
        resp = auth_client.get("/api/search?q=sap on aws")
        matches = [r for r in resp.json() if r["type"] == "solution_package"]
        assert len(matches) == 1
        assert matches[0]["title"] == "SAP on AWS Migration"
        assert matches[0]["url"].startswith("/solution-packages/")

    def test_no_match_returns_empty(self, auth_client):
        resp = auth_client.get("/api/search?q=zzzznomatchzzzz")
        assert resp.json() == []
