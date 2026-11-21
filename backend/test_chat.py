"""Optional manual provider smoke test. Never runs a request during test discovery."""

if __name__ == "__main__":
    import argparse
    import os
    import django

    parser = argparse.ArgumentParser()
    parser.add_argument("--user-id", type=int, required=True)
    parser.add_argument("--dataset-id", type=int, required=True)
    args = parser.parse_args()
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    django.setup()
    from api.agent.workflow import process_chat_query

    print(
        process_chat_query(
            args.dataset_id,
            "What columns does this dataset contain?",
            user_id=args.user_id,
        )
    )
