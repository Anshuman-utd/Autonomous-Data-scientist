import os
from typing import TypedDict, Annotated, Sequence
import operator
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage
from langgraph.prebuilt import ToolNode
from langgraph.graph import StateGraph, END
from langchain_groq import ChatGroq
from .tools import analyze_missing_values, analyze_outliers, summarize_model_metrics

# Load API Key (For production, guarantee this is set in environment or settings)
# Example fallback to prevent hard crashes when api key is missing for UI building:
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "dummy_key_replace_me")

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    dataset_id: int

tools = [analyze_missing_values, analyze_outliers, summarize_model_metrics]
tool_node = ToolNode(tools)

def should_continue(state):
    messages = state["messages"]
    last_message = messages[-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "continue"
    return "end"

def call_model(state):
    messages = state["messages"]
    dataset_id = state["dataset_id"]
    
    # Pre-configure LLM
    try:
        # Use a dummy mode if no real key is present to allow UI logic to pass
        if GROQ_API_KEY == "dummy_key_replace_me":
             return {"messages": [AIMessage(content="Groq API Key is missing. I cannot process this dataset yet. Setup your GROQ_API_KEY in backend environment.")]}
             
        model = ChatGroq(model="llama-3.1-8b-instant", temperature=0, groq_api_key=GROQ_API_KEY)
        model_with_tools = model.bind_tools(tools)
        
        # Inject dataset_id into the system context indirectly
        # It's better to force the tools to use the dataset_id explicitly by appending it to human prompt context if necessary
        # However, for simplicity here, we assume the user query is passed directly from Django view with "Dataset ID: X \\n Question: Y"
        response = model_with_tools.invoke(messages)
        return {"messages": [response]}
    except Exception as e:
        return {"messages": [AIMessage(content=f"LLM Error: {str(e)}")]}

# Build LangGraph
graph_builder = StateGraph(AgentState)
graph_builder.add_node("agent", call_model)
graph_builder.add_node("action", tool_node)

graph_builder.set_entry_point("agent")

# Condition to decide if tools are needed
graph_builder.add_conditional_edges(
    "agent",
    should_continue,
    {
        "continue": "action",
        "end": END,
    }
)
graph_builder.add_edge("action", "agent")

compiled_workflow = graph_builder.compile()

def process_chat_query(dataset_id: int, user_query: str, history: list = None) -> str:
    """Entry point for Django View to call LangGraph"""
    if not history:
        history = []
        
    messages = []
    for h in history:
        messages.append(HumanMessage(content=h['question']))
        messages.append(AIMessage(content=h['answer']))
        
    # Append the latest query along with the implicit context hook
    context_hook = f"[System instruction: You are a friendly Autonomous Data Scientist analyzing Dataset ID {dataset_id}. Use your tools if requested about data statistics, missing values, or models. Do not guess stats without tool usage.]\n\nUser: {user_query}"
    messages.append(HumanMessage(content=context_hook))
    
    state = {
        "messages": messages,
        "dataset_id": dataset_id
    }
    
    try:
        final_state = compiled_workflow.invoke(state)
        return final_state["messages"][-1].content
    except Exception as e:
        return f"Error executing AI Workflow: {str(e)}"
