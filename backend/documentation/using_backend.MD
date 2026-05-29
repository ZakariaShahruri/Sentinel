# FastAPI vs Spring Boot — Backend Reference

---

## Annotations / Route decorators

In Spring Boot, you annotate a method with `@GetMapping`, `@PostMapping`, etc. on a `@RestController` class.

In FastAPI, you decorate a function with `@router.get()`, `@router.post()`, etc. on an `APIRouter` instance.

```java
// Spring Boot
@RestController
@RequestMapping("/events")
public class EventController {
    @GetMapping
    public List<Event> listEvents() { ... }
}
```

```python
# FastAPI
router = APIRouter()

@router.get("/events")
def list_events():
    ...
```

Key difference: in Spring Boot, `@RestController` automatically serializes return values to JSON. FastAPI does the same — whatever you return from a route function (dict, list, Pydantic model) is automatically serialized to JSON. You never manually call `return ResponseEntity.ok(...)`.

---

## Router vs Controller class

Spring Boot groups endpoints in a `@RestController` class. FastAPI uses an `APIRouter` object — it's just a variable, not a class. Multiple routers are registered in `main.py` via `app.include_router(...)`, which is equivalent to Spring's component scanning picking up all `@RestController` beans.

```python
# main.py
app.include_router(eventController.router)
app.include_router(nodeController.router)
app.include_router(api.router)
```

---

## Path parameters

Spring Boot: `@PathVariable`  
FastAPI: declare the parameter in the path string with `{name}` and add it as a function argument with the same name. FastAPI matches them automatically.

```java
// Spring Boot
@GetMapping("/{id}")
public Event getEvent(@PathVariable int id) { ... }
```

```python
# FastAPI
@router.get("/events/{event_id}")
def get_event(event_id: int):
    ...
```

The type annotation (`int`) is not just documentation — FastAPI uses it to automatically parse and validate the value. If someone calls `/events/abc`, FastAPI rejects it with a 422 before your function is even called.

---

## Query parameters — `Query(...)`

Spring Boot: `@RequestParam`  
FastAPI: declare a function argument with a default value. If it has a default, it becomes an optional query parameter. Wrapping it in `Query(...)` lets you add constraints and metadata.

```java
// Spring Boot
@GetMapping
public List<Event> list(@RequestParam(required = false) String nodeId) { ... }
```

```python
# FastAPI
@router.get("/events")
def list_events(node_id: Optional[str] = Query(None)):
    ...
```

`Query(None)` means: optional query parameter, defaults to `None` if not provided.

`Query(False)` means: optional query parameter, defaults to `False` if not provided.

`Query(50, ge=1, le=500)` means: optional query parameter, defaults to `50`, and FastAPI will reject any value less than 1 or greater than 500 with a 422 before your code runs. `ge` = greater-than-or-equal, `le` = less-than-or-equal. Spring Boot equivalent would be `@Min`/`@Max` with `@Valid`.

You can call these endpoints like:
```
GET /events?node_id=node_01&limit=100
GET /tamper-events?open_only=true
```

---

## Request body — Pydantic models

Spring Boot: `@RequestBody` with a Java class (often a DTO).  
FastAPI: declare a function argument typed as a Pydantic `BaseModel` subclass. No annotation needed — FastAPI detects it from the type.

```java
// Spring Boot
@PutMapping("/{id}")
public Node update(@PathVariable String id, @RequestBody NodeUpdateDto body) { ... }
```

```python
# FastAPI — schemas.py
class NodeUpdate(BaseModel):
    location: str

# nodeController.py
@router.put("/nodes/{node_id}")
def update_node(node_id: str, body: NodeUpdate):
    ...
```

Pydantic validates the request body automatically. If `location` is missing or not a string, FastAPI returns a 422 with a clear error message before your function runs. No `@Valid` annotation needed — it's always on.

Unlike Java DTOs, Pydantic models have no getters/setters. Access fields directly: `body.location`.

---

## Dependency Injection — `Depends(...)`

Spring Boot: `@Autowired` injects beans managed by the Spring container.  
FastAPI: `Depends(some_function)` calls `some_function` and injects its return value into your route.

```python
def get_conn():
    conn = psycopg2.connect(os.getenv("DB_URL"), ...)
    try:
        yield conn       # connection is given to the route function
    finally:
        conn.close()     # runs after the response is sent

@router.get("/events")
def list_events(conn=Depends(get_conn)):
    ...
```

`conn=Depends(get_conn)` means: "before calling `list_events`, call `get_conn()`, take what it yields, and pass it in as `conn`."

The `yield` in `get_conn` is the key part. Everything before `yield` runs before the route (setup — open DB connection). Everything after `yield` runs after the response is sent (teardown — close connection). This is equivalent to Spring's `@Transactional` or a `try-with-resources` block wrapped around the whole request.

FastAPI handles one dependency per request — each request gets its own fresh connection, which is closed when the response is done. No connection pooling leaks.

---

## HTTP exceptions

Spring Boot: `throw new ResponseStatusException(HttpStatus.NOT_FOUND, "message")`  
FastAPI: `raise HTTPException(status_code=404, detail="message")`

```python
from fastapi import HTTPException

row = events.get_event(conn, event_id)
if row is None:
    raise HTTPException(status_code=404, detail="Event not found")
return row
```

FastAPI catches `HTTPException` automatically and turns it into the correct HTTP response with the detail as the JSON body. You never need a `@ExceptionHandler`.

---

## Service layer

Spring Boot: `@Service` classes injected via `@Autowired`.  
FastAPI: plain Python modules (files) with plain functions. No class needed, no annotation needed.

```python
# service/events.py — just a function in a file
def list_events(conn, node_id, event_class, limit):
    ...
```

You import and call them directly in the controller:

```python
from service import events
events.list_events(conn, ...)
```

There is no IoC container managing these. They are just functions. The database connection is passed in as an argument (dependency injection by hand, rather than by framework).

---

## Environment variables / configuration

Spring Boot: `application.properties` or `application.yml`, injected with `@Value`.  
FastAPI: a `.env` file loaded by `python-dotenv`, read with `os.getenv("KEY")`.

```python
# main.py
from dotenv import load_dotenv
load_dotenv()   # reads .env into environment

# deps.py
conn = psycopg2.connect(os.getenv("DB_URL"), ...)
```

There is no typed config class like `@ConfigurationProperties`. If you want that, you'd add a Pydantic `BaseSettings` class, but we don't use one here.

---

## CORS

Spring Boot: `@CrossOrigin` or a `WebMvcConfigurer` bean.  
FastAPI: `CORSMiddleware` added in `main.py`.

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # any origin can call the API
    allow_methods=["*"],
    allow_headers=["*"],
)
```

`allow_origins=["*"]` is fine for a local project dashboard but would be locked down to specific origins in production.

---

## Automatic API docs

FastAPI generates interactive Swagger UI automatically — no extra dependency, no configuration.

- `http://127.0.0.1:8000/docs` — Swagger UI, try every endpoint in the browser
- `http://127.0.0.1:8000/redoc` — alternative cleaner docs view
- `http://127.0.0.1:8000/openapi.json` — raw OpenAPI schema

Spring Boot needs `springdoc-openapi` added as a dependency to get the same. In FastAPI it is always there.

---

## Return types and serialization

Spring Boot: `ResponseEntity<T>` or just `T` (Jackson serializes it).  
FastAPI: just return a dict, list, or Pydantic model. FastAPI serializes it.

```python
@router.get("/stats")
def get_stats(conn=Depends(get_conn)):
    return {"events_today": 5, "active_nodes": 2}   # automatically becomes JSON
```

`psycopg2` with `RealDictCursor` (set in `deps.py`) returns rows as dict-like objects, so `cur.fetchall()` can be returned directly from a route and FastAPI will serialize it without any manual mapping.

---

## Type hints

Python type hints (`: int`, `: Optional[str]`, etc.) are not enforced at runtime by Python itself — but FastAPI reads them at startup to build its validation and serialization logic. This means:

- A type hint on a path/query parameter tells FastAPI how to parse and validate the incoming value.
- A type hint on a Pydantic model field tells Pydantic how to validate the request body.
- A missing or wrong type doesn't crash at import time — it silently skips validation for that field.

So unlike Java where the compiler enforces types, here it is FastAPI doing the enforcement at request time, not the language at compile time.

---

## Running the server

```powershell
uvicorn main:app --reload
```

- `main` — the filename (`main.py`)
- `app` — the `FastAPI()` instance inside it
- `--reload` — restart automatically on file save (development only)

There is no equivalent of Spring Boot's embedded Tomcat starting on `main()`. Uvicorn is the server; FastAPI is the application it runs.