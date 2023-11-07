from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import psycopg2
from psycopg2 import Error
import os
import secrets

app = Flask(__name__)
CORS(app)

class PostgresHandler:
    def __init__(self, username: str, password: str, host_name: str, port: int, database: str):
        db_params = {
            "dbname": database,
            "user": username,
            "password": password,
            "host": host_name,
            "port": port
        }
        self._connection = psycopg2.connect(**db_params)
        print("Handler Success")
    

    def create_table(self, name: str, column: str):
        cursor = self._connection.cursor()
        cursor.execute(f"CREATE TABLE IF NOT EXISTS {name} ({column})")
        self._connection.commit()
        cursor.close()
    
    def clear_table(self, name: str):
        cursor = self._connection.cursor()
        cursor.execute(f"DELETE FROM {name}")
        self._connection.commit()
        cursor.close()

    def check_row_exists(self, table_name: str, column_name: str, value: str):
        cursor = self._connection.cursor()
        query = f"SELECT 1 FROM {table_name} WHERE {column_name} = %s"
        cursor.execute(query, (value,))
        result = cursor.fetchone()
        cursor.close()

        if result is not None:
            return True
        else:
            return False
    
    def insert_row(self, table_name, column, data):
        try:
            cursor  = self._connection.cursor()
            placeholders = ', '.join(['%s'] * len(data))
            query = f"INSERT INTO {table_name} ({column}) VALUES ({placeholders})"
            cursor.execute(query, data)
            self._connection.commit()
            print("Data Inserted:", data)
        except Error as err:
            self._connection.rollback()
            print("Error inserting data")
            print(err)
            if "duplicate key" not in str(err).lower():
                return False
        return True
    
    def get_rows(self, table_name: str, column: str, value: str):
        try:
            cursor = self._connection.cursor()
            query = f"SELECT * FROM {table_name} WHERE {column} = %s"
            cursor.execute(query, (value,))
            result = cursor.fetchall()
            return result
        except Error as e:
            self._connection.rollback()
            print(f"Failed to fetch row from {table_name} WHERE {column} is {value}")
            print(e)
            return False
    
    def get_random_row(self, table_name: str, count: int, condition: str = None):
        if condition is None:
            condition = "1 = 1"
        try:
            cursor = self._connection.cursor()
            query = f"SELECT * FROM {table_name} WHERE {condition} ORDER BY RANDOM() LIMIT {str(count)}"
            cursor.execute(query)
            result = cursor.fetchall()
            return result
        except Error as e:
            self._connection.rollback()
            print(f"Failed to select random rows from {table_name}")
            print(e)
            return False
    
    def check_health(self):
        cursor = self._connection.cursor()
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        cursor.close()
        if result is not None:
            return True
        else:
            return False
    
    def delete_row(self, table_name: str, column: str, value: str):
        try:
            cursor = self._connection.cursor()
            query = f"DELETE FROM {table_name} WHERE {column} = %s"
            cursor.execute(query, (value,))
            self._connection.commit()
            print("Data Deleted:", value)
        except Error as e:
            self._connection.rollback()
            print(f"Failed to delete row from {table_name} WHERE {column} is {value}")
            print(e)
            return False
        return True

    
    def close_connection(self):
        self._connection.close()

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
    return render_template('index.html')

@app.route('/server_auth')
def server_side_auth_demo():
    return render_template('server_auth.html')

@app.route('/api/affiliation/<org>')
def generate_organization_captcha(org):
    server = create_database_connection()
    create_session = False
    if(request.args.get('auth') == "server"):
        create_session = True
    if server.check_health() is False:
        return jsonify({"error": "Database Connection Failed. Dynamic Affiliation Endpoint requires a PostgreSQL Connection"}), 500
    if server.check_row_exists("vtuber_data", "organization", org) is False:
        return jsonify({"error": "Organization not found in Database"}), 404
    correct_answers= server.get_random_row('vtuber_data', 5, "organization = '"+org+"'")
    random_answers = server.get_random_row('vtuber_data', 11)
    server.close_connection()
    question_data = [{"image": question[3], "name": question[1], "affiliation": question[2], "id": question[0] } for question in correct_answers + random_answers]
    if create_session:
        server = create_database_connection()
        session_id = secrets.token_urlsafe(16)
        solutions = []
        for question in question_data:
            if question['affiliation'] == org:
                solutions.append(question['id'])
        server.insert_row("sessions", "session_id, answer", (session_id, ",".join(solutions)))
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
    auth = request.headers.get("Authorization")
    stored_auth = os.environ.get("AUTHORIZATION")
    cron_secret = os.environ.get("CRON_SECRET")
    if auth != stored_auth or auth != cron_secret:
        return jsonify({"error": "Unauthorized"}), 401
    server = create_database_connection()
    if server.check_health() is False:
        return jsonify({"error": "Cannot connect to verification database"}), 500
    server.clear_table("sessions")
    server.close_connection()
    return jsonify({"success": True})


if __name__ == "__main__":
    app.run(debug=True)
