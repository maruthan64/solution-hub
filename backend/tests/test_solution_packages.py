class TestSolutionPackages:
    def test_requires_auth(self, client):
        resp = client.get("/api/solution-packages")
        assert resp.status_code == 401

    def test_viewer_can_list_but_not_create(self, client, make_user):
        user, password = make_user(role="Viewer")
        client.post("/api/auth/login", json={"username": user.username, "password": password})
        assert client.get("/api/solution-packages").status_code == 200
        resp = client.post(
            "/api/solution-packages",
            json={"name": "Test Package", "cloud": "AWS"},
        )
        assert resp.status_code == 403

    def test_owner_can_create_with_full_fields(self, auth_client):
        resp = auth_client.post(
            "/api/solution-packages",
            json={
                "name": "SAP on AWS Migration",
                "cloud": "AWS",
                "tagline": "Move SAP off legacy hardware.",
                "outcome": "Customers avoid a hardware refresh.",
                "assumptions": ["Customer has an existing AWS account."],
                "services": [{"service": "EC2", "purpose": "SAP application tier"}],
                "referenceArchitecture": "HANA on X2iedn, Multi-AZ.",
                "pricingNote": "Starting at $25,000.",
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "SAP on AWS Migration"
        assert body["assumptions"] == ["Customer has an existing AWS account."]
        assert body["services"] == [{"service": "EC2", "purpose": "SAP application tier"}]
        assert body["pricingNote"] == "Starting at $25,000."
        assert body["id"].startswith("sol-")

    def test_create_defaults_assumptions_to_empty_list(self, auth_client):
        resp = auth_client.post("/api/solution-packages", json={"name": "No Assumptions", "cloud": "AWS"})
        assert resp.status_code == 201
        assert resp.json()["assumptions"] == []

    def test_update_assumptions(self, auth_client):
        created = auth_client.post("/api/solution-packages", json={"name": "Original", "cloud": "AWS"}).json()
        resp = auth_client.put(
            f"/api/solution-packages/{created['id']}",
            json={"name": "Original", "cloud": "AWS", "assumptions": ["Assumption one.", "Assumption two."]},
        )
        assert resp.status_code == 200
        assert resp.json()["assumptions"] == ["Assumption one.", "Assumption two."]

    def test_update_solution_package(self, auth_client):
        created = auth_client.post(
            "/api/solution-packages", json={"name": "Original", "cloud": "AWS"}
        ).json()
        resp = auth_client.put(
            f"/api/solution-packages/{created['id']}",
            json={"name": "Renamed", "cloud": "Azure", "tagline": "Updated tagline"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "Renamed"
        assert body["cloud"] == "Azure"
        assert body["tagline"] == "Updated tagline"

    def test_update_nonexistent_returns_404(self, auth_client):
        resp = auth_client.put("/api/solution-packages/sol-doesnotexist", json={"name": "X", "cloud": "AWS"})
        assert resp.status_code == 404

    def test_delete_solution_package(self, auth_client):
        created = auth_client.post(
            "/api/solution-packages", json={"name": "To Delete", "cloud": "AWS"}
        ).json()
        resp = auth_client.delete(f"/api/solution-packages/{created['id']}")
        assert resp.status_code == 200
        ids = {p["id"] for p in auth_client.get("/api/solution-packages").json()}
        assert created["id"] not in ids

    def test_get_by_id(self, auth_client):
        created = auth_client.post(
            "/api/solution-packages", json={"name": "Lookup Me", "cloud": "AWS"}
        ).json()
        resp = auth_client.get(f"/api/solution-packages/{created['id']}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Lookup Me"

    def test_get_by_id_nonexistent_returns_404(self, auth_client):
        resp = auth_client.get("/api/solution-packages/sol-doesnotexist")
        assert resp.status_code == 404

    def test_viewer_cannot_delete(self, client, make_user, auth_client):
        created = auth_client.post(
            "/api/solution-packages", json={"name": "Protected", "cloud": "AWS"}
        ).json()
        user, password = make_user(role="Viewer")
        client.post("/api/auth/login", json={"username": user.username, "password": password})
        resp = client.delete(f"/api/solution-packages/{created['id']}")
        assert resp.status_code == 403


class TestSolutionPackageExport:
    def test_requires_auth(self, client):
        resp = client.get("/api/solution-packages/sol-anything/export")
        assert resp.status_code == 401

    def test_export_docx(self, auth_client):
        created = auth_client.post(
            "/api/solution-packages",
            json={
                "name": "Export Me",
                "cloud": "AWS",
                "outcome": "Some outcome.",
                "assumptions": ["An assumption."],
            },
        ).json()
        resp = auth_client.get(f"/api/solution-packages/{created['id']}/export?format=docx")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        assert len(resp.content) > 0

    def test_export_pdf(self, auth_client):
        created = auth_client.post("/api/solution-packages", json={"name": "Export Me PDF", "cloud": "AWS"}).json()
        resp = auth_client.get(f"/api/solution-packages/{created['id']}/export?format=pdf")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert len(resp.content) > 0

    def test_export_invalid_format_rejected(self, auth_client):
        created = auth_client.post("/api/solution-packages", json={"name": "X", "cloud": "AWS"}).json()
        resp = auth_client.get(f"/api/solution-packages/{created['id']}/export?format=xml")
        assert resp.status_code == 400

    def test_export_nonexistent_returns_404(self, auth_client):
        resp = auth_client.get("/api/solution-packages/sol-doesnotexist/export")
        assert resp.status_code == 404


class TestSolutionPackagesModuleAccess:
    def test_new_module_is_seeded_into_built_in_roles(self, auth_client):
        resp = auth_client.get("/api/role-permissions")
        assert resp.status_code == 200
        by_role = {r["role"]: r for r in resp.json()}
        for role in ("Owner", "Architect", "Reviewer", "Viewer"):
            assert "/solution-packages" in by_role[role]["allowedModules"]
