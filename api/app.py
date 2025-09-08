from flask import Flask, render_template, jsonify, request, redirect
from flask_cors import CORS
from .database import PostgresHandler
import os
import secrets
from dotenv import load_dotenv
import urllib.parse

load_dotenv()
app = Flask(__name__)
CORS(app)

def create_database_connection():
    """
    Creates a database connection using the environment variables
    :param: auth_append: str = "" - If you want to use a different set of variables for persisitance of sessions
    """
    hostname = os.environ.get("POSTGRES_HOST")
    user = os.environ.get("POSTGRES_USER")
    password = os.environ.get("POSTGRES_PASSWORD")
    database = os.environ.get("POSTGRES_DATABASE")
    return PostgresHandler(host_name=hostname, username=user, password=password, database=database, port=5432)

def initialize_auth_database():
    server = create_database_connection()
    server.create_table("sessions", "session_id VARCHAR(255) PRIMARY KEY, answer VARCHAR(1000), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    server.close_connection()
initialize_auth_database()

@app.route('/')
def index_demo():
    return redirect("https://captcha.moekyun.me", code=302) # Demo Site

@app.route('/api/list_orgs')
def get_available_orgs():
    server = create_database_connection()
    return server.get_distinct_col("vtuber_data", "affiliation")

@app.route('/api/affiliation/<org>')
def generate_organization_captcha(org):
    server = create_database_connection()
    create_session = False
    org = urllib.parse.unquote(org)
    if(request.args.get('auth') == "server"):
        create_session = True
    if server.check_health() is False:
        return jsonify({"error": "Database Connection Failed. Dynamic Affiliation Endpoint requires a PostgreSQL Connection"}), 500
    if server.check_row_exists("vtuber_data", "affiliation", org) is False:
        return jsonify({"error": "Organization " + org + " was not found in the database" }), 404
    correct_answers= server.get_random_row('vtuber_data', 5, "affiliation = '"+org+"'")
    random_answers = server.get_random_row('vtuber_data', 11)
    server.close_connection()
    question_data = [{"image": question[3], "name": question[1], "affiliation": question[2], "id": question[0] } for question in correct_answers + random_answers]
    if create_session:
        server = create_database_connection()
        session_id = secrets.token_urlsafe(16)
        solutions = []
        for question in question_data:
            if question['affiliation'] == org:
                solutions.append(str(question['id']))
        server.insert_row("sessions", "session_id, answer", (session_id, ",".join(solutions)))
        for question in question_data:
            del question["affiliation"]
        return_data = {
            "category": "affiliation",
            "title": "Select all the VTuber affiliated with "+org,
            "questions": question_data,
            "onFail": {
                "text": "You got some wrong",
                "extra": None
            },
            "session": session_id
        }
    else:
        for question in question_data:
            if question['affiliation'] == org:
                question['answer'] = True
            else:
                question['answer'] = False
        return_data = {
            "category": "affiliation",
            "title": "Select all the VTubers affiliated with "+org,
            "questions": question_data,
            "onFail": {
                "text": "You got some wrong",
                "extra": None
            }
        }
    return jsonify(return_data)

@app.route("/api/verify", methods=["POST"])
def verify_answers():
    session_id = request.form.get('session')
    answer = request.form.get('answer')
    print("[Verify Answer] " + session_id + answer)
    server = create_database_connection()
    if server.check_health() is False:
        return jsonify({"error": "Cannot connect to verification database"}), 500
    if server.check_row_exists("sessions", "session_id", session_id) is False:
        return jsonify({"error": "Session ID not found"}), 404
    correct_answers = server.get_rows("sessions", "session_id", session_id)[0][1].split(",")
    server.delete_row("sessions", "session_id", session_id)
    server.close_connection()
    if answer == ",".join(correct_answers):
        return jsonify({"success": True})
    else:
        return jsonify({"success": False})

@app.route("/api/clear_sessions")
def clear_sessions():
    auth_header = request.headers.get("Authorization")
    cron_secret = os.environ.get("CRON_SECRET")
    expected_auth = f"Bearer {cron_secret}"
    print(f"Received Request to Clear Session: Checking if '{auth_header}' matches '{expected_auth}'")
    if not cron_secret:
        return jsonify({"error": "CRON_SECRET not configured"}), 500
    if auth_header != expected_auth:
        return jsonify({"error": "Unauthorized"}), 401
    server = create_database_connection()
    if server.check_health() is False:
        return jsonify({"error": "Cannot connect to verification database"}), 500
    server.clear_table("sessions")
    server.close_connection()
    return jsonify({"success": True})


if __name__ == "__main__":
    app.run(debug=True)
