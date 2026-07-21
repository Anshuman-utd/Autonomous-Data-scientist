from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.svm import SVC, SVR
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.naive_bayes import GaussianNB
import concurrent.futures

def _fit_model(name, model, X_train, y_train):
    try:
        model.fit(X_train, y_train)
        return name, model
    except Exception as e:
        import sys
        sys.stderr.write(f"Failed to train {name}: {str(e)}\n")
        return name, None

def train_models(X, y, problem_type):
    """
    Trains multiple models in parallel based on the problem type.
    """
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    n_samples = X_train.shape[0]
    
    models = {}
    estimators = {}
    
    if problem_type == "classification":
        # SVM safety: switch to LinearSVC or restrict standard non-linear SVC if samples are high
        if n_samples > 2000:
            from sklearn.svm import LinearSVC
            svm_model = LinearSVC(max_iter=10000, random_state=42)
            svm_name = "Support Vector Machine (Linear SVM)"
        else:
            svm_model = SVC(probability=True, max_iter=10000, random_state=42)
            svm_name = "Support Vector Machine (SVM)"
            
        estimators = {
            "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
            "Random Forest Classifier": RandomForestClassifier(n_estimators=100, random_state=42),
            "Decision Tree": DecisionTreeClassifier(random_state=42),
            svm_name: svm_model,
            "K-Nearest Neighbors (KNN)": KNeighborsClassifier(),
            "Naive Bayes": GaussianNB()
        }
                
    elif problem_type == "regression":
        # SVM safety: switch to LinearSVR or restrict standard non-linear SVR if samples are high
        if n_samples > 2000:
            from sklearn.svm import LinearSVR
            svm_model = LinearSVR(max_iter=10000, random_state=42)
            svm_name = "Support Vector Machine (Linear SVM)"
        else:
            svm_model = SVR(max_iter=10000)
            svm_name = "Support Vector Machine (SVM)"
            
        estimators = {
            "Linear Regression": LinearRegression(),
            "Random Forest Regressor": RandomForestRegressor(n_estimators=100, random_state=42),
            "Decision Tree": DecisionTreeRegressor(random_state=42),
            svm_name: svm_model,
            "K-Nearest Neighbors (KNN)": KNeighborsRegressor()
        }
    else:
        raise ValueError(f"Unknown problem type: {problem_type}")
        
    # Fit estimators concurrently using a ThreadPoolExecutor
    # Max workers set to 3 to balance thread creation and single-CPU cores on free hosting tiers
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = {
            executor.submit(_fit_model, name, model, X_train, y_train): name
            for name, model in estimators.items()
        }
        for future in concurrent.futures.as_completed(futures):
            name, trained_model = future.result()
            if trained_model is not None:
                models[name] = trained_model
                
    return models, X_test, y_test

