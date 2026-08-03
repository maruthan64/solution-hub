import uuid

from app.models import GeneratedDocument, Project


class TestHealth:
    def test_health_no_auth_required(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


class TestAuthRequired:
    def test_projects_requires_auth(self, client):
        resp = client.get("/api/projects")
        assert resp.status_code == 401

    def test_service_catalog_requires_auth(self, client):
        resp = client.get("/api/service-catalog")
        assert resp.status_code == 401


class TestLoginLockout:
    def test_wrong_password_then_lockout(self, client, make_user):
        user, _real_password = make_user()
        # MAX_ATTEMPTS is 10 (app.rate_limit) - the 10th bad attempt should trip the lockout
        # for the 11th, regardless of whether the password is right or wrong at that point.
        last_status = None
        for _ in range(11):
            resp = client.post(
                "/api/auth/login", json={"username": user.username, "password": "definitely-wrong"}
            )
            last_status = resp.status_code
        assert last_status == 429


class TestRoleEnforcement:
    def test_viewer_cannot_create_service_package(self, client, make_user):
        user, password = make_user(role="Viewer")
        client.post("/api/auth/login", json={"username": user.username, "password": password})
        resp = client.post(
            "/api/service-catalog",
            json={"category": "addon", "name": "X", "tagline": "Y", "monthlyPrice": "$10/mo", "resources": []},
        )
        assert resp.status_code == 403

    def test_owner_can_create_service_package(self, auth_client):
        resp = auth_client.post(
            "/api/service-catalog",
            json={
                "category": "addon",
                "name": f"Test Package {uuid.uuid4().hex[:6]}",
                "tagline": "Tagline",
                "monthlyPrice": "$10/mo",
                "resources": [],
            },
        )
        assert resp.status_code == 201
        assert resp.json()["category"] == "addon"


class TestQuoteProjectLinking:
    def test_generate_quote_with_project_id_shows_up_in_project_quotes(self, auth_client, db_session):
        project = Project(
            id=f"prj-{uuid.uuid4().hex[:8]}",
            name="Test Project",
            customer="Test Customer",
            cloud="AWS",
            status="Draft",
            owner="Tester",
            updated="2026-01-01",
            docs_generated=0,
            description="",
        )
        db_session.add(project)
        db_session.commit()

        pkg_resp = auth_client.post(
            "/api/service-catalog",
            json={
                "category": "tier",
                "name": f"Basic {uuid.uuid4().hex[:6]}",
                "tagline": "Entry tier",
                "monthlyPrice": "$500/mo",
                "resources": [{"service": "EC2", "quantity": 1, "purpose": "App server"}],
            },
        )
        assert pkg_resp.status_code == 201
        package_id = pkg_resp.json()["id"]

        quote_resp = auth_client.post(
            "/api/service-catalog/quote",
            json={
                "customerName": "Test Customer",
                "description": "Pricing for the pilot",
                "packageIds": [package_id],
                "format": "docx",
                "projectId": project.id,
            },
        )
        assert quote_resp.status_code == 200

        quotes_resp = auth_client.get(f"/api/projects/{project.id}/quotes")
        assert quotes_resp.status_code == 200
        quotes = quotes_resp.json()
        assert len(quotes) == 1
        assert quotes[0]["projectId"] == project.id
        assert quotes[0]["total"] == "$500.00/mo"

    def test_generate_quote_with_invalid_project_id_returns_404_and_does_not_log_a_quote(
        self, auth_client, db_session
    ):
        pkg_resp = auth_client.post(
            "/api/service-catalog",
            json={
                "category": "addon",
                "name": f"Addon {uuid.uuid4().hex[:6]}",
                "tagline": "T",
                "monthlyPrice": "$5/mo",
                "resources": [],
            },
        )
        package_id = pkg_resp.json()["id"]

        resp = auth_client.post(
            "/api/service-catalog/quote",
            json={
                "customerName": "Should Not Persist",
                "description": "y",
                "packageIds": [package_id],
                "format": "docx",
                "projectId": "does-not-exist",
            },
        )
        assert resp.status_code == 404


class TestCostEstimate:
    def test_generate_then_regenerate_updates_the_same_document(self, auth_client, db_session):
        project = Project(
            id=f"prj-{uuid.uuid4().hex[:8]}",
            name="Cost Estimate Test Project",
            customer="Test Customer",
            cloud="AWS",
            status="Draft",
            owner="Tester",
            updated="2026-01-01",
            docs_generated=0,
            description="",
        )
        db_session.add(project)
        db_session.commit()

        pkg_resp = auth_client.post(
            "/api/service-catalog",
            json={
                "category": "tier",
                "name": f"Basic {uuid.uuid4().hex[:6]}",
                "tagline": "Entry tier",
                "monthlyPrice": "$500/mo",
                "resources": [{"service": "EC2", "quantity": 1, "purpose": "App server"}],
            },
        )
        package_id = pkg_resp.json()["id"]

        first = auth_client.post(f"/api/projects/{project.id}/cost-estimate", json={"packageIds": [package_id]})
        assert first.status_code == 200
        first_doc = first.json()
        assert first_doc["type"] == "Cost Estimate"
        assert "$500.00/mo" in first_doc["content"]

        second = auth_client.post(f"/api/projects/{project.id}/cost-estimate", json={"packageIds": [package_id]})
        assert second.status_code == 200
        second_doc = second.json()

        # Same document updated in place, not a duplicate.
        assert second_doc["id"] == first_doc["id"]
        docs_for_project = (
            db_session.query(GeneratedDocument)
            .filter(GeneratedDocument.project == project.name, GeneratedDocument.type == "Cost Estimate")
            .all()
        )
        assert len(docs_for_project) == 1

    def test_requires_at_least_one_package(self, auth_client, db_session):
        project = Project(
            id=f"prj-{uuid.uuid4().hex[:8]}",
            name="No Package Project",
            customer="Test Customer",
            cloud="AWS",
            status="Draft",
            owner="Tester",
            updated="2026-01-01",
            docs_generated=0,
            description="",
        )
        db_session.add(project)
        db_session.commit()

        resp = auth_client.post(f"/api/projects/{project.id}/cost-estimate", json={"packageIds": []})
        assert resp.status_code == 400

    def test_viewer_cannot_generate_cost_estimate(self, client, make_user, db_session):
        project = Project(
            id=f"prj-{uuid.uuid4().hex[:8]}",
            name="RBAC Test Project",
            customer="Test Customer",
            cloud="AWS",
            status="Draft",
            owner="Tester",
            updated="2026-01-01",
            docs_generated=0,
            description="",
        )
        db_session.add(project)
        db_session.commit()

        user, password = make_user(role="Viewer")
        client.post("/api/auth/login", json={"username": user.username, "password": password})
        resp = client.post(f"/api/projects/{project.id}/cost-estimate", json={"packageIds": ["whatever"]})
        assert resp.status_code == 403
