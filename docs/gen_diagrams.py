"""
Architecture diagrams — CSE 230 AI Assembly Course
Uses `diagrams` (mingrammer) + graphviz.
Each diagram is constrained to letter-page size at 150 dpi.
  Diagrams 1 & 2 → landscape  10 x 7.5 in  → 1500 x 1125 px
  Diagram  3     → portrait   7.5 x 10 in  → 1125 x 1500 px
Run:  python3 docs/gen_diagrams.py
"""

import os
os.chdir("/Users/darshchaurasia/Documents/WORKSPACE/ASU/Courses/Courses Semester Wise/Fall 2025/CSE485/Capstone Project - Master Repo/AI-driven-self-paced-course-for-Assembly-CSE-230-/docs")


from diagrams import Diagram, Cluster, Edge
from diagrams.onprem.client          import Users
from diagrams.onprem.network         import Internet
from diagrams.programming.framework  import FastAPI, React
from diagrams.onprem.database        import PostgreSQL
from diagrams.generic.storage        import Storage
from diagrams.generic.compute        import Rack
from diagrams.onprem.container       import Docker
from diagrams.gcp.ml                 import AIPlatform
from diagrams.onprem.mlops           import Mlflow

# ── shared style dicts ────────────────────────────────────────────────────────
BASE_GRAPH = {
    "fontname":  "Helvetica",
    "fontsize":  "18",
    "bgcolor":   "white",
    "fontcolor": "#111827",
    "pad":       "0.5",
    "dpi":       "200",
}

NODE_ATTR = {
    "fontname":  "Helvetica",
    "fontsize":  "16",
    "fontcolor": "#111827",
    "style":     "filled",
}

EDGE_ATTR = {
    "fontname":  "Helvetica",
    "fontsize":  "13",
    "fontcolor": "#374151",
    "color":     "#6b7280",
}

CL = {   # cluster base
    "fontname":  "Helvetica Bold",
    "fontsize":  "11",
    "fontcolor": "#111827",
    "style":     "rounded,filled",
    "fillcolor": "#f8fafc",
    "color":     "#94a3b8",
    "penwidth":  "1.5",
}

def cl(**kw):
    """Merge cluster overrides into CL base."""
    return {**CL, **kw}


# ══════════════════════════════════════════════════════════════════════════════
#  DIAGRAM 1 — System Architecture  (landscape letter)
# ══════════════════════════════════════════════════════════════════════════════
def diagram1():
    # portrait letter at 200 dpi → 1700x2200 px
    g = {**BASE_GRAPH,
         "size":    "8.5,11!",
         "splines": "ortho",
         "ranksep": "0.6",
         "nodesep": "0.5"}

    with Diagram(
        "CSE 230  ·  System Architecture",
        filename="arch-01-system", outformat="png", show=False,
        direction="TB", graph_attr=g, node_attr=NODE_ATTR, edge_attr=EDGE_ATTR,
    ):
        browser = Users("Browser\nStudent / Instructor")

        with Cluster("docker-compose  (default network)",
                     graph_attr=cl(fillcolor="#eff6ff", color="#3b82f6", penwidth="2")):

            with Cluster("frontend  :3000  |  Next.js 14",
                         graph_attr=cl(fillcolor="#dbeafe", color="#1d4ed8")):
                fe = React("Next.js 14\n/  /module/[id]\n/sandbox  /progress\n/teacher [staff]")

            with Cluster("backend  :8000  |  FastAPI + Uvicorn",
                         graph_attr=cl(fillcolor="#f5f3ff", color="#7c3aed")):

                with Cluster("Routers", graph_attr=cl(fillcolor="#ede9fe", color="#6d28d9")):
                    r_auth  = FastAPI("/auth\nsignup · login · me")
                    r_fetch = FastAPI("/fetch\nquery · quiz\nsandbox · sync")
                    r_prog  = FastAPI("/progress\nquiz-result · me\nteacher/* [staff]")
                    r_mod   = FastAPI("/modules\nCRUD + upload-pdf\n[staff writes]")
                    r_pine  = FastAPI("/pinecone\nstatus · ingest\nsearch")
                    r_push  = FastAPI("/pushback\nconnect · repost\nreset-assignments")

                with Cluster("Services", graph_attr=cl(fillcolor="#f1f5f9", color="#475569")):
                    svc_auth = Rack("auth_service\nbcrypt + JWT")
                    svc_ai   = AIPlatform("ai_service\nCreateAI  30s")
                    svc_emb  = Mlflow("embedding_svc\nbge-small  384d")
                    svc_pin  = Storage("pinecone_svc\nupsert/query")
                    svc_cvs  = Internet("canvas_svc\ncanvasapi")

                with Cluster("MIPS Sandbox",
                             graph_attr=cl(fillcolor="#fffbeb", color="#f59e0b")):
                    spim = Docker("spim\n2.5s timeout")

                with Cluster("Volumes",
                             graph_attr=cl(fillcolor="#f1f5f9", color="#64748b")):
                    kb      = Storage("knowledge-base\n(read-only)")
                    uploads = Storage("static/uploads")

            with Cluster("db  :5432  |  pgvector/pg16  |  Vol: db_data",
                         graph_attr=cl(fillcolor="#dcfce7", color="#065f46")):
                db = PostgreSQL("PostgreSQL 16\nusers · modules\nmodule_resources\nmodule_progress\ntopic_progress\ncanvas_user_map\ncanvas_assign_map")

        with Cluster("External Services",
                     graph_attr=cl(fillcolor="#f8fafc", color="#64748b")):
            createai = AIPlatform("CreateAI  (ASU AIML)\napi-main.aiml.asu.edu\nopenai / gpt4")
            pinecone = Storage("Pinecone\nindex: cse230\n384-dim  cosine")
            canvas   = Internet("Canvas LMS\nREST API v1\ncanvas.asu.edu")

        # ── edges ─────────────────────────────────────────────────────────────
        browser >> Edge(label=":3000", color="#3b82f6") >> fe
        fe >> Edge(label="REST", color="#6d28d9") >> r_auth
        fe >> Edge(color="#6d28d9") >> r_fetch
        fe >> Edge(color="#6d28d9") >> r_prog
        fe >> Edge(color="#6d28d9") >> r_mod

        r_auth  >> Edge(color="#6d28d9") >> svc_auth
        r_fetch >> Edge(color="#6d28d9") >> svc_ai
        r_fetch >> Edge(color="#6d28d9") >> svc_emb
        r_fetch >> Edge(color="#6d28d9") >> spim
        r_fetch >> Edge(color="#6d28d9") >> svc_cvs
        r_prog  >> Edge(color="#065f46") >> db
        r_mod   >> Edge(color="#6d28d9") >> uploads
        r_pine  >> Edge(color="#0284c7") >> svc_pin
        r_push  >> Edge(color="#b45309") >> svc_cvs

        svc_auth >> Edge(color="#065f46") >> db
        svc_emb  >> Edge(color="#0f766e") >> kb
        svc_ai   >> Edge(label="Bearer", color="#9333ea") >> createai
        svc_emb  >> Edge(label="vectors", color="#0284c7") >> pinecone
        svc_pin  >> Edge(color="#0284c7") >> pinecone
        svc_cvs  >> Edge(label="PUT grade", color="#b45309") >> canvas
        r_prog   >> Edge(color="#b45309") >> canvas

    print("Saved arch-01-system.png")


# ══════════════════════════════════════════════════════════════════════════════
#  DIAGRAM 2 — AI / RAG Pipeline  (landscape letter)
# ══════════════════════════════════════════════════════════════════════════════
def diagram2():
    g = {**BASE_GRAPH,
         "size":    "11,8.5!",
         "splines": "curved",
         "ranksep": "0.8",
         "nodesep": "0.5"}

    with Diagram(
        "CSE 230  ·  AI / RAG Pipeline",
        filename="arch-02-ai-rag-pipeline", outformat="png", show=False,
        direction="LR", graph_attr=g, node_attr=NODE_ATTR, edge_attr=EDGE_ATTR,
    ):
        browser = Users("Browser")

        with Cluster("FLOW A  ·  Tutor Chat\nPOST /fetch/query",
                     graph_attr=cl(fillcolor="#dbeafe", color="#1d4ed8")):
            a_route = FastAPI("/fetch/query")
            a_embed = Mlflow("embed_text\n384-dim")
            a_pine  = Storage("query_vectors\ntop_k=3")
            a_ai    = AIPlatform("CreateAI\nRAG + prompt")
            a_route >> a_embed >> a_pine >> Edge(label="KB chunks") >> a_ai

        with Cluster("FLOW B  ·  Quiz Generation\nPOST /fetch/quiz  (<=5 retries)",
                     graph_attr=cl(fillcolor="#f5f3ff", color="#7c3aed")):
            b_route  = FastAPI("/fetch/quiz\nloop <=5")
            b_embed  = Mlflow("chunk+embed\nbatch 32")
            b_pine   = Storage("query_vectors\nmodule filter")
            b_ai     = AIPlatform("CreateAI\n5 MCQ JSON")
            b_parse  = Rack("7-level parser\nvalidate+dedup")
            b_route >> b_embed >> b_pine >> Edge(label="context") >> b_ai
            b_ai >> b_parse
            b_parse >> Edge(label="retry", style="dashed", color="#f59e0b") >> b_route

        with Cluster("FLOW C  ·  Grade Posting\nPOST /progress/quiz-result",
                     graph_attr=cl(fillcolor="#dcfce7", color="#065f46")):
            c_route  = FastAPI("/progress\n/quiz-result")
            c_db     = PostgreSQL("upsert\nmodule+topic\nprogress")
            c_lookup = PostgreSQL("lookup\ncanvas maps")
            c_canvas = Internet("Canvas\nPUT grade")
            c_miss   = Internet("Canvas\nGET user\nPOST assign")
            c_route >> c_db >> c_lookup
            c_lookup >> Edge(label="exists") >> c_canvas
            c_lookup >> Edge(label="missing", style="dashed") >> c_miss
            c_miss   >> Edge(label="store", color="#065f46") >> c_db

        with Cluster("FLOW D  ·  Canvas Sync  [staff]\nPOST /fetch/sync/{id}",
                     graph_attr=cl(fillcolor="#fff7ed", color="#b45309")):
            d_route  = FastAPI("/fetch/sync\n[staff only]")
            d_canvas = Internet("canvas_svc\nsyllabus+pages")
            d_embed  = Mlflow("chunk+embed")
            d_pine   = Storage("upsert_vectors\ncse230 ns")
            d_route >> d_canvas >> d_embed >> d_pine

        browser >> Edge(label="query", color="#1d4ed8") >> a_route
        browser >> Edge(label="quiz",  color="#7c3aed") >> b_route
        browser >> Edge(label="score", color="#065f46") >> c_route
        browser >> Edge(label="sync",  color="#b45309") >> d_route
        a_ai    >> Edge(label="response", color="#1d4ed8") >> browser
        b_parse >> Edge(label="questions", color="#7c3aed") >> browser

    print("Saved arch-02-ai-rag-pipeline.png")


# ══════════════════════════════════════════════════════════════════════════════
#  DIAGRAM 3 — Backend API Map  (portrait letter)
# ══════════════════════════════════════════════════════════════════════════════
def diagram3():
    g = {**BASE_GRAPH,
         "size":    "8.5,11!",
         "splines": "ortho",
         "ranksep": "0.7",
         "nodesep": "0.5"}

    with Diagram(
        "CSE 230  ·  Backend API Map",
        filename="arch-03-backend-api-map", outformat="png", show=False,
        direction="TB", graph_attr=g, node_attr=NODE_ATTR, edge_attr=EDGE_ATTR,
    ):
        # ── Routers ──────────────────────────────────────────────────────────
        with Cluster("FastAPI Routers  ·  /backend/app/api/",
                     graph_attr=cl(fillcolor="#f5f3ff", color="#7c3aed")):
            r_auth  = FastAPI("/auth\nPOST signup login\nGET me users/me")
            r_fetch = FastAPI("/fetch\nPOST query quiz\nsandbox/run sync")
            r_prog  = FastAPI("/progress\nPOST quiz-result\nGET me teacher/*")
            r_mod   = FastAPI("/modules\nGET list detail\nPOST PUT DELETE\nupload-pdf [staff]")
            r_pine  = FastAPI("/pinecone\nGET status\nPOST ingest search")
            r_push  = FastAPI("/pushback\nPOST connect-me\nrepost reset [staff]")

        # ── Services ──────────────────────────────────────────────────────────
        with Cluster("Services  ·  /backend/app/services/",
                     graph_attr=cl(fillcolor="#f1f5f9", color="#475569")):
            s_auth = Rack("auth_service\nbcrypt + JWT HS256\n1440 min")
            s_ai   = AIPlatform("ai_service\nCreateAI wrapper\ngpt4  30s")
            s_emb  = Mlflow("embedding_svc\nBAAI/bge-small\n384-dim  batch 32")
            s_pin  = Storage("pinecone_svc\nquery_vectors\nupsert 64/batch")
            s_cvs  = Internet("canvas_svc\ncanvasapi\nstrip HTML")

        # ── DB Models ─────────────────────────────────────────────────────────
        with Cluster("PostgreSQL  ·  pgvector/pg16  ·  SQLAlchemy ORM",
                     graph_attr=cl(fillcolor="#dcfce7", color="#065f46")):
            db_users = PostgreSQL("users\nuserid PK · email\nsis_user_id · role\nhashed_password")
            db_mods  = PostgreSQL("modules  (id 1-13)\ntitle · is_published\n\nmodule_resources\nmodule_id FK · kind\ntitle · url")
            db_prog  = PostgreSQL("user_module_progress\nuserid+module_id UNIQUE\nbest/last_score · attempts\n\nuser_topic_progress\nuserid+module_id+topic\nbest/last scores")
            db_cvs   = PostgreSQL("canvas_user_map\nuserid <-> canvas_user_id\n\ncanvas_module_assignment_map\nmodule_id <-> assignment_id")

        ext_ai  = AIPlatform("CreateAI\naiml.asu.edu")
        ext_pin = Storage("Pinecone\ncse230 ns")
        ext_cvs = Internet("Canvas LMS\ncanvas.asu.edu")

        # router -> service
        r_auth  >> Edge(color="#1d4ed8") >> s_auth
        r_fetch >> Edge(color="#9333ea") >> s_ai
        r_fetch >> Edge(color="#0f766e") >> s_emb
        r_fetch >> Edge(color="#b45309") >> s_cvs
        r_pine  >> Edge(color="#0284c7") >> s_pin
        r_push  >> Edge(color="#b45309") >> s_cvs
        r_prog  >> Edge(color="#065f46") >> db_prog
        r_mod   >> Edge(color="#6d28d9") >> db_mods

        # service -> db / external
        s_auth >> Edge(color="#065f46") >> db_users
        s_emb  >> Edge(color="#0f766e") >> db_mods
        s_ai   >> Edge(label="LLM",     color="#9333ea") >> ext_ai
        s_emb  >> Edge(label="vectors", color="#0284c7") >> ext_pin
        s_pin  >> Edge(color="#0284c7") >> ext_pin
        s_cvs  >> Edge(label="REST v1", color="#b45309") >> ext_cvs

        db_users - Edge(style="invis") - db_mods
        db_mods  - Edge(style="invis") - db_prog
        db_prog  - Edge(style="invis") - db_cvs

    print("Saved arch-03-backend-api-map.png")


if __name__ == "__main__":
    diagram1()
    diagram2()
    diagram3()
    print("\nAll 3 diagrams generated in docs/")
