"""Optional manual provider smoke test. Standard tests mock external services."""

if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    from langchain_groq import ChatGroq

    load_dotenv()
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        raise SystemExit("GROQ_API_KEY is required for this optional provider test.")
    model = ChatGroq(
        model=os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b"),
        temperature=0,
        groq_api_key=key,
        timeout=20,
        max_retries=0,
    )
    print(model.invoke("Say hi").content)
