import os
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend import app


class CompanyFlowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.root = root
        self.db, self.artifacts = root / "test.sqlite", root / "workspace"
        self.artifacts.mkdir()
        self.root_patch = patch.object(app, "ROOT", root)
        self.db_patch = patch.object(app, "DB", self.db)
        self.artifact_patch = patch.object(app, "ARTIFACTS", self.artifacts)
        self.root_patch.start(); self.db_patch.start(); self.artifact_patch.start()
        app.init()

    def tearDown(self):
        self.artifact_patch.stop(); self.db_patch.stop(); self.root_patch.stop(); self.temp.cleanup()

    def test_seed_and_command_create_real_project_and_assignments(self):
        with patch.object(app.threading, "Thread") as thread:
            result = app.command("Build a restaurant website with a menu")
        with app.connect() as conn:
            self.assertEqual(conn.execute("SELECT count(*) FROM employees").fetchone()[0], 9)
            self.assertEqual(conn.execute("SELECT count(*) FROM projects").fetchone()[0], 2)
            tasks = conn.execute("SELECT employee_id,status FROM tasks WHERE project_id=?", (result["project_id"],)).fetchall()
            self.assertEqual(len(tasks), 7)
            self.assertTrue(all(t["status"] == "TODO" for t in tasks))
            self.assertEqual(conn.execute("SELECT count(*) FROM messages WHERE project_id=?", (result["project_id"],)).fetchone()[0], 1)
        self.assertEqual(thread.call_count, 7)

    def test_missing_key_marks_task_blocked_and_records_explanation(self):
        with app.connect() as conn:
            task = conn.execute("SELECT id FROM tasks LIMIT 1").fetchone()[0]
        with patch.dict(os.environ, {}, clear=True):
            app.run_task(task)
        with app.connect() as conn:
            row = conn.execute("SELECT status,result FROM tasks WHERE id=?", (task,)).fetchone()
            self.assertEqual(row["status"], "BLOCKED")
            self.assertIn("OPENAI_API_KEY", row["result"])
            self.assertEqual(conn.execute("SELECT count(*) FROM artifacts WHERE task_id=?", (task,)).fetchone()[0], 0)

    def test_new_ui_actions_save_project_message_and_daily_report(self):
        def request(path, payload):
            body = json.dumps(payload).encode()
            handler = object.__new__(app.Handler)
            handler.path = path
            handler.headers = {"Content-Length": str(len(body))}
            handler.rfile = io.BytesIO(body)
            handler.respond = lambda value, status=200: (value, status)
            return handler.do_POST()

        project, status = request("/api/projects", {"name": "UI Test Project", "description": "Persist this project"})
        self.assertEqual(status, 201)
        with app.connect() as conn:
            self.assertEqual(conn.execute("SELECT name FROM projects WHERE id=?", (project["id"],)).fetchone()[0], "UI Test Project")
        message, status = request("/api/messages", {"body": "CEO status note"})
        self.assertEqual(status, 201)
        with app.connect() as conn:
            self.assertEqual(conn.execute("SELECT employee_id FROM messages WHERE id=?", (message["id"],)).fetchone()[0], None)
        meeting, status = request("/api/meetings", {"title": "Design review", "starts_at": "2026-09-24T14:00:00+00:00", "agenda": "Review the interface", "participants": ["mia", "alex"]})
        self.assertEqual(status, 201)
        with app.connect() as conn:
            self.assertEqual(conn.execute("SELECT title FROM meetings WHERE id=?", (meeting["id"],)).fetchone()[0], "Design review")
        report, status = request("/api/reports/daily", {})
        self.assertEqual(status, 201)
        self.assertTrue((Path(self.temp.name) / report["path"]).exists())


if __name__ == "__main__":
    unittest.main()
