import os
import uvicorn

if __name__ == "__main__":
    # PORT is injected by the hosting platform (e.g. Railway); defaults to 5000 locally.
    port = int(os.environ.get("PORT", 5000))
    uvicorn.run("src.app:app", host="0.0.0.0", port=port, reload=False)
