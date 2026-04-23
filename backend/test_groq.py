import os
from dotenv import load_dotenv
load_dotenv()
from langchain_groq import ChatGroq
try:
    llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0, groq_api_key=os.environ.get("GROQ_API_KEY"))
    res = llm.invoke("Say hi")
    print("Success:", res.content)
except Exception as e:
    print("Error:", str(e))
