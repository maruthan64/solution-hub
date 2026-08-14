import uuid


def _role_name() -> str:
    return f"Sales-{uuid.uuid4().hex[:8]}"


class TestRolePermissions:
    def test_requires_owner(self, client, make_user):
        user, password = make_user(role="Viewer")
        client.post("/api/auth/login", json={"username": user.username, "password": password})
        resp = client.get("/api/role-permissions")
        assert resp.status_code == 403

    def test_built_in_roles_are_seeded_with_full_access(self, auth_client):
        resp = auth_client.get("/api/role-permissions")
        assert resp.status_code == 200
        by_role = {r["role"]: r for r in resp.json()}
        for role in ("Owner", "Architect", "Reviewer", "Viewer"):
            assert by_role[role]["builtIn"] is True
            assert "/service-catalog" in by_role[role]["allowedModules"]
            assert "/users" in by_role[role]["allowedModules"]

    def test_create_custom_role_with_restricted_modules(self, auth_client):
        role = _role_name()
        resp = auth_client.post(
            "/api/role-permissions",
            json={"role": role, "allowedModules": ["/service-catalog", "/capabilities", "/knowledge-base"]},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["role"] == role
        assert body["builtIn"] is False
        assert set(body["allowedModules"]) == {"/service-catalog", "/capabilities", "/knowledge-base"}

    def test_create_duplicate_role_rejected(self, auth_client):
        role = _role_name()
        first = auth_client.post("/api/role-permissions", json={"role": role, "allowedModules": []})
        assert first.status_code == 201
        resp = auth_client.post("/api/role-permissions", json={"role": role, "allowedModules": []})
        assert resp.status_code == 400

    def test_create_with_unknown_module_rejected(self, auth_client):
        resp = auth_client.post(
            "/api/role-permissions", json={"role": _role_name(), "allowedModules": ["/nonexistent"]}
        )
        assert resp.status_code == 400

    def test_update_allowed_modules(self, auth_client):
        role = _role_name()
        auth_client.post("/api/role-permissions", json={"role": role, "allowedModules": ["/service-catalog"]})
        resp = auth_client.put(
            f"/api/role-permissions/{role}", json={"allowedModules": ["/service-catalog", "/capabilities"]}
        )
        assert resp.status_code == 200
        assert set(resp.json()["allowedModules"]) == {"/service-catalog", "/capabilities"}

    def test_delete_built_in_role_rejected(self, auth_client):
        resp = auth_client.delete("/api/role-permissions/Viewer")
        assert resp.status_code == 400

    def test_delete_role_still_assigned_to_a_user_rejected(self, auth_client, make_user):
        role = _role_name()
        auth_client.post("/api/role-permissions", json={"role": role, "allowedModules": ["/service-catalog"]})
        make_user(role=role)
        resp = auth_client.delete(f"/api/role-permissions/{role}")
        assert resp.status_code == 400

    def test_delete_unused_custom_role_succeeds(self, auth_client):
        role = _role_name()
        auth_client.post("/api/role-permissions", json={"role": role, "allowedModules": []})
        resp = auth_client.delete(f"/api/role-permissions/{role}")
        assert resp.status_code == 200
        roles = {r["role"] for r in auth_client.get("/api/role-permissions").json()}
        assert role not in roles


class TestDynamicRoleAssignment:
    def test_creating_user_with_unknown_role_rejected(self, auth_client):
        resp = auth_client.post(
            "/api/users",
            json={"name": "Test", "username": f"test.{uuid.uuid4().hex[:8]}", "role": _role_name(), "password": "testpass123"},
        )
        assert resp.status_code == 400

    def test_creating_user_with_newly_defined_role_succeeds(self, auth_client):
        role = _role_name()
        auth_client.post("/api/role-permissions", json={"role": role, "allowedModules": ["/service-catalog"]})
        resp = auth_client.post(
            "/api/users",
            json={"name": "Test", "username": f"test.{uuid.uuid4().hex[:8]}", "role": role, "password": "testpass123"},
        )
        assert resp.status_code == 201
        assert resp.json()["user"]["role"] == role


class TestCurrentUserAllowedModules:
    def test_me_returns_allowed_modules_for_role(self, client, make_user):
        user, password = make_user(role="Viewer")
        client.post("/api/auth/login", json={"username": user.username, "password": password})
        resp = client.get("/api/auth/me")
        assert resp.status_code == 200
        assert "/service-catalog" in resp.json()["allowedModules"]

    def test_me_reflects_restricted_custom_role(self, auth_client, client, make_user):
        role = _role_name()
        auth_client.post(
            "/api/role-permissions",
            json={"role": role, "allowedModules": ["/service-catalog", "/capabilities", "/knowledge-base"]},
        )
        user, password = make_user(role=role)
        client.post("/api/auth/login", json={"username": user.username, "password": password})
        resp = client.get("/api/auth/me")
        assert resp.status_code == 200
        assert set(resp.json()["allowedModules"]) == {"/service-catalog", "/capabilities", "/knowledge-base"}
