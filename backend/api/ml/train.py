from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.svm import SVC, SVR
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.naive_bayes import GaussianNB

def train_models(X, y, problem_type):
    """
    Trains multiple models based on the problem type.
    """
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    models = {}
    
    if problem_type == "classification":
        # Initialize Classification Models
        classifiers = {
            "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
            "Random Forest Classifier": RandomForestClassifier(n_estimators=100, random_state=42),
            "Decision Tree": DecisionTreeClassifier(random_state=42),
            "Support Vector Machine (SVM)": SVC(probability=True, random_state=42),
            "K-Nearest Neighbors (KNN)": KNeighborsClassifier(),
            "Naive Bayes": GaussianNB()
        }
        
        # Train all models
        for name, model in classifiers.items():
            try:
                model.fit(X_train, y_train)
                models[name] = model
            except Exception as e:
                print(f"Failed to train {name}: {str(e)}")
                
    elif problem_type == "regression":
        # Initialize Regression Models
        regressors = {
            "Linear Regression": LinearRegression(),
            "Random Forest Regressor": RandomForestRegressor(n_estimators=100, random_state=42),
            "Decision Tree": DecisionTreeRegressor(random_state=42),
            "Support Vector Machine (SVM)": SVR(),
            "K-Nearest Neighbors (KNN)": KNeighborsRegressor()
        }
        
        # Train all models
        for name, model in regressors.items():
            try:
                model.fit(X_train, y_train)
                models[name] = model
            except Exception as e:
                print(f"Failed to train {name}: {str(e)}")
    else:
        raise ValueError(f"Unknown problem type: {problem_type}")
        
    return models, X_test, y_test
