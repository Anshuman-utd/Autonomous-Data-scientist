import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from api.models import Dataset
from api.agent.workflow import process_chat_query

dataset = Dataset.objects.last()

if dataset:
    print(f"Testing on dataset {dataset.id}")
    try:
        ans = process_chat_query(dataset.id, "Hello, what columns do I have?")
        print(ans)
    except Exception as e:
        import traceback
        traceback.print_exc()
else:
    print("No dataset found in the entire DB.")
