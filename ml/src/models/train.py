"""Train LightGBM and Isolation Forest fraud scoring models."""
import os
import joblib
import pandas as pd
import numpy as np
import lightgbm as lgb
from sklearn.ensemble import IsolationForest
from sklearn.metrics import classification_report, roc_auc_score, average_precision_score
import shap

from ml.data.synthetic.upi_generator import generate_upi_dataset
from ml.src.features.engineer import engineer_features

def train_pipeline():
    # Make sure output directories exist
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    output_dir = os.path.join(base_dir, "backend", "app", "ml_models")
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs("data", exist_ok=True)
    
    # 1. Generate data if not exists
    raw_path = "data/raw_transactions.csv"
    if not os.path.exists(raw_path):
        generate_upi_dataset(num_transactions=20000, output_path=raw_path)
        
    # 2. Engineer features if not exists
    features_path = "data/processed_features.csv"
    if not os.path.exists(features_path):
        df = pd.read_csv(raw_path)
        feat_df = engineer_features(df)
        feat_df.to_csv(features_path, index=False)
    else:
        feat_df = pd.read_csv(features_path)
        
    print("Features loaded. Shape:", feat_df.shape)
    
    # Define Target and Feature Columns
    target_col = "is_fraud"
    feature_cols = [c for c in feat_df.columns if c != target_col]
    
    X = feat_df[feature_cols]
    y = feat_df[target_col]
    
    # Temporal train/test split (e.g. first 80% train, last 20% test)
    split_idx = int(len(feat_df) * 0.8)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
    
    print(f"Train set: {X_train.shape}, Test set: {X_test.shape}")
    print(f"Train fraud rate: {y_train.mean():.2%}, Test fraud rate: {y_test.mean():.2%}")
    
    # 3. Train LightGBM Classifier
    print("Training LightGBM model...")
    # Compute class weight
    fraud_count = sum(y_train == 1)
    legit_count = sum(y_train == 0)
    scale_pos_weight = legit_count / fraud_count if fraud_count > 0 else 99.0
    
    # Define parameters (SRD Section 6.2)
    lgb_params = {
        "objective": "binary",
        "metric": "auc",
        "boosting_type": "gbdt",
        "num_leaves": 63,
        "max_depth": 7,
        "learning_rate": 0.05,
        "n_estimators": 200,
        "scale_pos_weight": scale_pos_weight,
        "min_child_samples": 20,
        "feature_fraction": 0.8,
        "bagging_fraction": 0.8,
        "bagging_freq": 5,
        "verbose": -1,
        "n_jobs": 4
    }
    
    lgb_model = lgb.LGBMClassifier(**lgb_params)
    lgb_model.fit(X_train, y_train)
    
    # Evaluate LightGBM
    y_pred_lgb = lgb_model.predict_proba(X_test)[:, 1]
    auc_lgb = roc_auc_score(y_test, y_pred_lgb)
    pr_auc_lgb = average_precision_score(y_test, y_pred_lgb)
    print(f"LightGBM AUC: {auc_lgb:.4f} | PR-AUC: {pr_auc_lgb:.4f}")
    
    # 4. Train Isolation Forest (anomaly detection on normal txns)
    print("Training Isolation Forest...")
    # Train on legitimate transactions only
    X_train_legit = X_train[y_train == 0]
    
    iso_model = IsolationForest(
        n_estimators=100,
        contamination=0.02,
        random_state=42,
        n_jobs=4
    )
    iso_model.fit(X_train_legit)
    
    # Evaluate Isolation Forest
    # score_samples returns negative anomaly score. Let's normalize it to [0, 1]
    # More negative means more anomalous.
    raw_scores = iso_model.score_samples(X_test)
    # Min-max normalize to [0, 1] range where 1 is highly anomalous
    # Let's map it roughly: score_samples ranges from ~ -0.9 (anomaly) to -0.3 (normal)
    y_pred_iso = -raw_scores
    # Shift and scale to [0,1]
    y_pred_iso = (y_pred_iso - y_pred_iso.min()) / (y_pred_iso.max() - y_pred_iso.min() + 1e-9)
    
    auc_iso = roc_auc_score(y_test, y_pred_iso)
    print(f"Isolation Forest AUC (unsupervised): {auc_iso:.4f}")
    
    # 5. Fit SHAP Explainer (on entire LightGBM model)
    print("Fitting SHAP TreeExplainer...")
    # Use TreeExplainer for LightGBM
    explainer = shap.TreeExplainer(lgb_model)
    
    # 6. Save models and components to backend
    print(f"Saving models to {output_dir}...")
    joblib.dump(lgb_model, os.path.join(output_dir, "lgbm_model.pkl"))
    joblib.dump(iso_model, os.path.join(output_dir, "iso_forest_model.pkl"))
    joblib.dump(explainer, os.path.join(output_dir, "shap_explainer.pkl"))
    joblib.dump(feature_cols, os.path.join(output_dir, "feature_cols.pkl"))
    
    print("All models and explainers saved successfully!")

if __name__ == "__main__":
    train_pipeline()
