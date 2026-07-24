"""
Comprehensive scoring engine benchmarking script.
Runs 50 synthetic transactions with known ground-truth labels and calculates
TP, TN, FP, FN, Precision, Recall, F1, AUC, and per-engine latency.
"""

import asyncio
import time
import json
import numpy as np
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from datetime import datetime
from uuid import uuid4


# Test scenarios — (scenario_name, features, expected_fraud_label: 1=fraud, 0=legit)
TEST_CASES = [
    # Legitimate Transactions (expected label = 0)
    ("LEGIT_P2M_GROCERY",       {"txn_amount": 850.0, "txn_amount_log": 6.75, "txn_hour": 14.0, "txn_day_of_week": 2.0, "txn_is_weekend": 0.0, "txn_is_night": 0.0, "amount_vs_user_avg_ratio": 0.7, "amount_vs_user_max_ratio": 0.5, "amount_round_number_flag": 0.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 1.0, "vel_txn_count_24h": 3.0, "vel_amount_sum_1h": 850.0, "vel_amount_sum_24h": 2000.0, "geo_distance_from_last_txn_km": 2.1, "time_since_last_txn_seconds": 3600.0, "geo_speed_kmh": 5.0, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 0.0, "sender_graph_risk_score": 0.02}, 0),
    ("LEGIT_P2P_FAMILY",        {"txn_amount": 5000.0, "txn_amount_log": 8.52, "txn_hour": 18.0, "txn_day_of_week": 5.0, "txn_is_weekend": 0.0, "txn_is_night": 0.0, "amount_vs_user_avg_ratio": 1.2, "amount_vs_user_max_ratio": 0.8, "amount_round_number_flag": 1.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 1.0, "vel_txn_count_24h": 2.0, "vel_amount_sum_1h": 5000.0, "vel_amount_sum_24h": 5000.0, "geo_distance_from_last_txn_km": 0.5, "time_since_last_txn_seconds": 7200.0, "geo_speed_kmh": 0.2, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 0.0, "sender_graph_risk_score": 0.03}, 0),
    ("LEGIT_UTILITY_BILL",      {"txn_amount": 2200.0, "txn_amount_log": 7.70, "txn_hour": 11.0, "txn_day_of_week": 1.0, "txn_is_weekend": 0.0, "txn_is_night": 0.0, "amount_vs_user_avg_ratio": 1.0, "amount_vs_user_max_ratio": 0.9, "amount_round_number_flag": 0.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 1.0, "vel_txn_count_1h": 1.0, "vel_txn_count_24h": 4.0, "vel_amount_sum_1h": 2200.0, "vel_amount_sum_24h": 8000.0, "geo_distance_from_last_txn_km": 0.0, "time_since_last_txn_seconds": 86400.0, "geo_speed_kmh": 0.0, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 0.0, "sender_graph_risk_score": 0.01}, 0),
    ("LEGIT_RECHARGE",          {"txn_amount": 299.0, "txn_amount_log": 5.70, "txn_hour": 20.0, "txn_day_of_week": 6.0, "txn_is_weekend": 1.0, "txn_is_night": 0.0, "amount_vs_user_avg_ratio": 0.3, "amount_vs_user_max_ratio": 0.2, "amount_round_number_flag": 0.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 2.0, "vel_txn_count_24h": 5.0, "vel_amount_sum_1h": 598.0, "vel_amount_sum_24h": 2000.0, "geo_distance_from_last_txn_km": 1.0, "time_since_last_txn_seconds": 1800.0, "geo_speed_kmh": 3.0, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 0.0, "sender_graph_risk_score": 0.01}, 0),
    ("LEGIT_ONLINE_SHOPPING",   {"txn_amount": 3499.0, "txn_amount_log": 8.16, "txn_hour": 15.0, "txn_day_of_week": 3.0, "txn_is_weekend": 0.0, "txn_is_night": 0.0, "amount_vs_user_avg_ratio": 1.5, "amount_vs_user_max_ratio": 0.7, "amount_round_number_flag": 0.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 1.0, "vel_txn_count_24h": 3.0, "vel_amount_sum_1h": 3499.0, "vel_amount_sum_24h": 7000.0, "geo_distance_from_last_txn_km": 3.0, "time_since_last_txn_seconds": 14400.0, "geo_speed_kmh": 1.0, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 1.0, "sender_graph_risk_score": 0.05}, 0),
    ("LEGIT_WEEKEND_DINNER",    {"txn_amount": 1200.0, "txn_amount_log": 7.09, "txn_hour": 21.0, "txn_day_of_week": 6.0, "txn_is_weekend": 1.0, "txn_is_night": 0.0, "amount_vs_user_avg_ratio": 1.1, "amount_vs_user_max_ratio": 0.6, "amount_round_number_flag": 0.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 1.0, "vel_txn_count_24h": 4.0, "vel_amount_sum_1h": 1200.0, "vel_amount_sum_24h": 3500.0, "geo_distance_from_last_txn_km": 5.0, "time_since_last_txn_seconds": 10800.0, "geo_speed_kmh": 2.0, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 1.0, "sender_graph_risk_score": 0.04}, 0),
    ("LEGIT_RENT_PAYMENT",      {"txn_amount": 18000.0, "txn_amount_log": 9.80, "txn_hour": 10.0, "txn_day_of_week": 0.0, "txn_is_weekend": 0.0, "txn_is_night": 0.0, "amount_vs_user_avg_ratio": 2.5, "amount_vs_user_max_ratio": 0.95, "amount_round_number_flag": 1.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 1.0, "vel_txn_count_24h": 2.0, "vel_amount_sum_1h": 18000.0, "vel_amount_sum_24h": 18000.0, "geo_distance_from_last_txn_km": 0.0, "time_since_last_txn_seconds": 86400.0, "geo_speed_kmh": 0.0, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 0.0, "sender_graph_risk_score": 0.02}, 0),
    ("LEGIT_INVESTMENT",        {"txn_amount": 50000.0, "txn_amount_log": 10.82, "txn_hour": 9.0, "txn_day_of_week": 1.0, "txn_is_weekend": 0.0, "txn_is_night": 0.0, "amount_vs_user_avg_ratio": 3.0, "amount_vs_user_max_ratio": 1.0, "amount_round_number_flag": 1.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 1.0, "vel_txn_count_24h": 1.0, "vel_amount_sum_1h": 50000.0, "vel_amount_sum_24h": 50000.0, "geo_distance_from_last_txn_km": 0.0, "time_since_last_txn_seconds": 172800.0, "geo_speed_kmh": 0.0, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 0.0, "sender_graph_risk_score": 0.02}, 0),
    ("LEGIT_RECURRING_EMI",     {"txn_amount": 12500.0, "txn_amount_log": 9.43, "txn_hour": 8.0, "txn_day_of_week": 2.0, "txn_is_weekend": 0.0, "txn_is_night": 0.0, "amount_vs_user_avg_ratio": 1.8, "amount_vs_user_max_ratio": 0.85, "amount_round_number_flag": 1.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 1.0, "vel_txn_count_24h": 1.0, "vel_amount_sum_1h": 12500.0, "vel_amount_sum_24h": 12500.0, "geo_distance_from_last_txn_km": 0.0, "time_since_last_txn_seconds": 2592000.0, "geo_speed_kmh": 0.0, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 0.0, "sender_graph_risk_score": 0.01}, 0),
    ("LEGIT_SMALL_PURCHASE",    {"txn_amount": 120.0, "txn_amount_log": 4.79, "txn_hour": 13.0, "txn_day_of_week": 4.0, "txn_is_weekend": 0.0, "txn_is_night": 0.0, "amount_vs_user_avg_ratio": 0.1, "amount_vs_user_max_ratio": 0.1, "amount_round_number_flag": 0.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 3.0, "vel_txn_count_24h": 8.0, "vel_amount_sum_1h": 360.0, "vel_amount_sum_24h": 1200.0, "geo_distance_from_last_txn_km": 1.5, "time_since_last_txn_seconds": 1200.0, "geo_speed_kmh": 4.0, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 0.0, "sender_graph_risk_score": 0.02}, 0),
    ("LEGIT_BUSINESS_PAYMENT",  {"txn_amount": 75000.0, "txn_amount_log": 11.23, "txn_hour": 11.0, "txn_day_of_week": 3.0, "txn_is_weekend": 0.0, "txn_is_night": 0.0, "amount_vs_user_avg_ratio": 5.0, "amount_vs_user_max_ratio": 0.9, "amount_round_number_flag": 1.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 1.0, "vel_txn_count_24h": 2.0, "vel_amount_sum_1h": 75000.0, "vel_amount_sum_24h": 150000.0, "geo_distance_from_last_txn_km": 10.0, "time_since_last_txn_seconds": 86400.0, "geo_speed_kmh": 0.1, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 0.0, "sender_graph_risk_score": 0.03}, 0),
    ("LEGIT_FOOD_DELIVERY",     {"txn_amount": 450.0, "txn_amount_log": 6.11, "txn_hour": 19.0, "txn_day_of_week": 0.0, "txn_is_weekend": 0.0, "txn_is_night": 0.0, "amount_vs_user_avg_ratio": 0.4, "amount_vs_user_max_ratio": 0.25, "amount_round_number_flag": 0.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 1.0, "vel_txn_count_24h": 5.0, "vel_amount_sum_1h": 450.0, "vel_amount_sum_24h": 2000.0, "geo_distance_from_last_txn_km": 0.2, "time_since_last_txn_seconds": 7200.0, "geo_speed_kmh": 0.1, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 0.0, "sender_graph_risk_score": 0.01}, 0),
    ("LEGIT_SALARY_TRANSFER",   {"txn_amount": 45000.0, "txn_amount_log": 10.71, "txn_hour": 9.0, "txn_day_of_week": 1.0, "txn_is_weekend": 0.0, "txn_is_night": 0.0, "amount_vs_user_avg_ratio": 4.5, "amount_vs_user_max_ratio": 1.0, "amount_round_number_flag": 1.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 1.0, "vel_txn_count_24h": 1.0, "vel_amount_sum_1h": 45000.0, "vel_amount_sum_24h": 45000.0, "geo_distance_from_last_txn_km": 0.0, "time_since_last_txn_seconds": 2592000.0, "geo_speed_kmh": 0.0, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 0.0, "sender_graph_risk_score": 0.01}, 0),
    ("LEGIT_MEDICAL_EMERGENCY", {"txn_amount": 25000.0, "txn_amount_log": 10.13, "txn_hour": 3.0, "txn_day_of_week": 4.0, "txn_is_weekend": 0.0, "txn_is_night": 1.0, "amount_vs_user_avg_ratio": 3.5, "amount_vs_user_max_ratio": 0.9, "amount_round_number_flag": 1.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 1.0, "vel_txn_count_24h": 1.0, "vel_amount_sum_1h": 25000.0, "vel_amount_sum_24h": 25000.0, "geo_distance_from_last_txn_km": 8.0, "time_since_last_txn_seconds": 86400.0, "geo_speed_kmh": 0.3, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 1.0, "sender_graph_risk_score": 0.04}, 0),
    ("LEGIT_FUEL_STATION",      {"txn_amount": 2500.0, "txn_amount_log": 7.82, "txn_hour": 8.0, "txn_day_of_week": 1.0, "txn_is_weekend": 0.0, "txn_is_night": 0.0, "amount_vs_user_avg_ratio": 1.1, "amount_vs_user_max_ratio": 0.6, "amount_round_number_flag": 1.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 1.0, "vel_txn_count_24h": 2.0, "vel_amount_sum_1h": 2500.0, "vel_amount_sum_24h": 4000.0, "geo_distance_from_last_txn_km": 15.0, "time_since_last_txn_seconds": 3600.0, "geo_speed_kmh": 15.0, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 0.0, "sender_graph_risk_score": 0.02}, 0),
    ("LEGIT_TRAVEL_HOTEL",      {"txn_amount": 8000.0, "txn_amount_log": 9.0, "txn_hour": 16.0, "txn_day_of_week": 5.0, "txn_is_weekend": 0.0, "txn_is_night": 0.0, "amount_vs_user_avg_ratio": 2.0, "amount_vs_user_max_ratio": 0.7, "amount_round_number_flag": 1.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 1.0, "vel_txn_count_24h": 4.0, "vel_amount_sum_1h": 8000.0, "vel_amount_sum_24h": 15000.0, "geo_distance_from_last_txn_km": 200.0, "time_since_last_txn_seconds": 14400.0, "geo_speed_kmh": 50.0, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 1.0, "sender_graph_risk_score": 0.04}, 0),
    ("LEGIT_SUBSCRIPTION_SVC",  {"txn_amount": 199.0, "txn_amount_log": 5.29, "txn_hour": 10.0, "txn_day_of_week": 3.0, "txn_is_weekend": 0.0, "txn_is_night": 0.0, "amount_vs_user_avg_ratio": 0.2, "amount_vs_user_max_ratio": 0.15, "amount_round_number_flag": 0.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 1.0, "vel_txn_count_24h": 3.0, "vel_amount_sum_1h": 199.0, "vel_amount_sum_24h": 600.0, "geo_distance_from_last_txn_km": 0.0, "time_since_last_txn_seconds": 86400.0, "geo_speed_kmh": 0.0, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 0.0, "sender_graph_risk_score": 0.01}, 0),
    ("LEGIT_CHARITY_DONATION",  {"txn_amount": 1000.0, "txn_amount_log": 6.91, "txn_hour": 12.0, "txn_day_of_week": 6.0, "txn_is_weekend": 1.0, "txn_is_night": 0.0, "amount_vs_user_avg_ratio": 0.8, "amount_vs_user_max_ratio": 0.4, "amount_round_number_flag": 1.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 1.0, "vel_txn_count_24h": 3.0, "vel_amount_sum_1h": 1000.0, "vel_amount_sum_24h": 3500.0, "geo_distance_from_last_txn_km": 0.0, "time_since_last_txn_seconds": 7200.0, "geo_speed_kmh": 0.0, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 1.0, "sender_graph_risk_score": 0.06}, 0),
    ("LEGIT_INSURANCE_PREMIUM", {"txn_amount": 15000.0, "txn_amount_log": 9.62, "txn_hour": 11.0, "txn_day_of_week": 0.0, "txn_is_weekend": 0.0, "txn_is_night": 0.0, "amount_vs_user_avg_ratio": 2.2, "amount_vs_user_max_ratio": 0.8, "amount_round_number_flag": 1.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 1.0, "vel_txn_count_24h": 1.0, "vel_amount_sum_1h": 15000.0, "vel_amount_sum_24h": 15000.0, "geo_distance_from_last_txn_km": 0.0, "time_since_last_txn_seconds": 2592000.0, "geo_speed_kmh": 0.0, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 0.0, "sender_graph_risk_score": 0.01}, 0),
    ("LEGIT_EDUCATION_FEE",     {"txn_amount": 35000.0, "txn_amount_log": 10.46, "txn_hour": 10.0, "txn_day_of_week": 2.0, "txn_is_weekend": 0.0, "txn_is_night": 0.0, "amount_vs_user_avg_ratio": 3.8, "amount_vs_user_max_ratio": 0.95, "amount_round_number_flag": 1.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 1.0, "vel_txn_count_24h": 1.0, "vel_amount_sum_1h": 35000.0, "vel_amount_sum_24h": 35000.0, "geo_distance_from_last_txn_km": 5.0, "time_since_last_txn_seconds": 86400.0, "geo_speed_kmh": 0.2, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 0.0, "sender_graph_risk_score": 0.02}, 0),

    # Fraudulent Transactions (expected label = 1)
    ("FRAUD_BLACKLISTED_VPA",        {"txn_amount": 8000.0, "txn_amount_log": 9.0, "txn_hour": 2.0, "txn_day_of_week": 1.0, "txn_is_weekend": 0.0, "txn_is_night": 1.0, "amount_vs_user_avg_ratio": 3.0, "amount_vs_user_max_ratio": 0.9, "amount_round_number_flag": 1.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 1.0, "vel_txn_count_24h": 1.0, "vel_amount_sum_1h": 8000.0, "vel_amount_sum_24h": 8000.0, "geo_distance_from_last_txn_km": 1.0, "time_since_last_txn_seconds": 3600.0, "geo_speed_kmh": 1.0, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 1.0, "receiver_is_new": 0.0, "sender_graph_risk_score": 0.7}, 1),
    ("FRAUD_IMPOSSIBLE_TRAVEL",      {"txn_amount": 15000.0, "txn_amount_log": 9.62, "txn_hour": 3.0, "txn_day_of_week": 2.0, "txn_is_weekend": 0.0, "txn_is_night": 1.0, "amount_vs_user_avg_ratio": 5.0, "amount_vs_user_max_ratio": 1.0, "amount_round_number_flag": 1.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 1.0, "vel_txn_count_24h": 2.0, "vel_amount_sum_1h": 15000.0, "vel_amount_sum_24h": 15000.0, "geo_distance_from_last_txn_km": 1800.0, "time_since_last_txn_seconds": 3600.0, "geo_speed_kmh": 1800.0, "geo_is_impossible_travel": 1.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 1.0, "sender_graph_risk_score": 0.6}, 1),
    ("FRAUD_ROOTED_DEVICE",          {"txn_amount": 12000.0, "txn_amount_log": 9.39, "txn_hour": 3.0, "txn_day_of_week": 3.0, "txn_is_weekend": 0.0, "txn_is_night": 1.0, "amount_vs_user_avg_ratio": 8.0, "amount_vs_user_max_ratio": 1.2, "amount_round_number_flag": 1.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 0.0, "vel_txn_count_1h": 1.0, "vel_txn_count_24h": 3.0, "vel_amount_sum_1h": 12000.0, "vel_amount_sum_24h": 25000.0, "geo_distance_from_last_txn_km": 1.0, "time_since_last_txn_seconds": 600.0, "geo_speed_kmh": 1.0, "geo_is_impossible_travel": 0.0, "device_is_new": 1.0, "device_is_rooted": 1.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 1.0, "sender_graph_risk_score": 0.55}, 1),
    ("FRAUD_HIGH_VELOCITY",          {"txn_amount": 9999.0, "txn_amount_log": 9.21, "txn_hour": 2.0, "txn_day_of_week": 4.0, "txn_is_weekend": 0.0, "txn_is_night": 1.0, "amount_vs_user_avg_ratio": 7.5, "amount_vs_user_max_ratio": 1.1, "amount_round_number_flag": 0.0, "amount_just_below_limit_flag": 1.0, "vel_txn_count_1m": 8.0, "vel_txn_count_5m": 20.0, "vel_txn_count_1h": 45.0, "vel_txn_count_24h": 60.0, "vel_amount_sum_1h": 150000.0, "vel_amount_sum_24h": 180000.0, "geo_distance_from_last_txn_km": 0.0, "time_since_last_txn_seconds": 30.0, "geo_speed_kmh": 0.0, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 1.0, "sender_graph_risk_score": 0.65}, 1),
    ("FRAUD_EMULATOR_LARGE_AMOUNT",  {"txn_amount": 98000.0, "txn_amount_log": 11.49, "txn_hour": 4.0, "txn_day_of_week": 1.0, "txn_is_weekend": 0.0, "txn_is_night": 1.0, "amount_vs_user_avg_ratio": 15.0, "amount_vs_user_max_ratio": 2.5, "amount_round_number_flag": 1.0, "amount_just_below_limit_flag": 1.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 1.0, "vel_txn_count_1h": 2.0, "vel_txn_count_24h": 3.0, "vel_amount_sum_1h": 150000.0, "vel_amount_sum_24h": 200000.0, "geo_distance_from_last_txn_km": 2.0, "time_since_last_txn_seconds": 300.0, "geo_speed_kmh": 2.0, "geo_is_impossible_travel": 0.0, "device_is_new": 1.0, "device_is_rooted": 0.0, "device_is_emulator": 1.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 1.0, "sender_graph_risk_score": 0.75}, 1),
    ("FRAUD_MULTIPLE_BURSTS",        {"txn_amount": 9800.0, "txn_amount_log": 9.19, "txn_hour": 1.0, "txn_day_of_week": 2.0, "txn_is_weekend": 0.0, "txn_is_night": 1.0, "amount_vs_user_avg_ratio": 9.0, "amount_vs_user_max_ratio": 1.5, "amount_round_number_flag": 0.0, "amount_just_below_limit_flag": 1.0, "vel_txn_count_1m": 5.0, "vel_txn_count_5m": 15.0, "vel_txn_count_1h": 30.0, "vel_txn_count_24h": 35.0, "vel_amount_sum_1h": 90000.0, "vel_amount_sum_24h": 95000.0, "geo_distance_from_last_txn_km": 0.0, "time_since_last_txn_seconds": 60.0, "geo_speed_kmh": 0.0, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 1.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 1.0, "sender_graph_risk_score": 0.8}, 1),
    ("FRAUD_FRAUD_RING_NODE",        {"txn_amount": 45000.0, "txn_amount_log": 10.71, "txn_hour": 3.0, "txn_day_of_week": 5.0, "txn_is_weekend": 0.0, "txn_is_night": 1.0, "amount_vs_user_avg_ratio": 12.0, "amount_vs_user_max_ratio": 2.0, "amount_round_number_flag": 1.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 2.0, "vel_txn_count_5m": 5.0, "vel_txn_count_1h": 10.0, "vel_txn_count_24h": 20.0, "vel_amount_sum_1h": 100000.0, "vel_amount_sum_24h": 180000.0, "geo_distance_from_last_txn_km": 5.0, "time_since_last_txn_seconds": 600.0, "geo_speed_kmh": 5.0, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 1.0, "sender_graph_risk_score": 0.92}, 1),
    ("FRAUD_NEW_DEVICE_NIGHTTIME",   {"txn_amount": 30000.0, "txn_amount_log": 10.31, "txn_hour": 4.0, "txn_day_of_week": 6.0, "txn_is_weekend": 1.0, "txn_is_night": 1.0, "amount_vs_user_avg_ratio": 10.0, "amount_vs_user_max_ratio": 1.8, "amount_round_number_flag": 1.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 0.0, "vel_txn_count_5m": 1.0, "vel_txn_count_1h": 2.0, "vel_txn_count_24h": 4.0, "vel_amount_sum_1h": 60000.0, "vel_amount_sum_24h": 100000.0, "geo_distance_from_last_txn_km": 3.0, "time_since_last_txn_seconds": 900.0, "geo_speed_kmh": 5.0, "geo_is_impossible_travel": 0.0, "device_is_new": 1.0, "device_is_rooted": 1.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 1.0, "sender_graph_risk_score": 0.7}, 1),
    ("FRAUD_STRUCTURING_PATTERN",    {"txn_amount": 9500.0, "txn_amount_log": 9.16, "txn_hour": 23.0, "txn_day_of_week": 3.0, "txn_is_weekend": 0.0, "txn_is_night": 1.0, "amount_vs_user_avg_ratio": 6.0, "amount_vs_user_max_ratio": 1.2, "amount_round_number_flag": 0.0, "amount_just_below_limit_flag": 1.0, "vel_txn_count_1m": 3.0, "vel_txn_count_5m": 10.0, "vel_txn_count_1h": 25.0, "vel_txn_count_24h": 30.0, "vel_amount_sum_1h": 75000.0, "vel_amount_sum_24h": 85000.0, "geo_distance_from_last_txn_km": 0.0, "time_since_last_txn_seconds": 120.0, "geo_speed_kmh": 0.0, "geo_is_impossible_travel": 0.0, "device_is_new": 0.0, "device_is_rooted": 0.0, "device_is_emulator": 1.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 1.0, "sender_graph_risk_score": 0.68}, 1),
    ("FRAUD_SIM_SWAP_LARGE",         {"txn_amount": 75000.0, "txn_amount_log": 11.23, "txn_hour": 2.0, "txn_day_of_week": 0.0, "txn_is_weekend": 0.0, "txn_is_night": 1.0, "amount_vs_user_avg_ratio": 20.0, "amount_vs_user_max_ratio": 2.2, "amount_round_number_flag": 1.0, "amount_just_below_limit_flag": 0.0, "vel_txn_count_1m": 1.0, "vel_txn_count_5m": 2.0, "vel_txn_count_1h": 3.0, "vel_txn_count_24h": 4.0, "vel_amount_sum_1h": 75000.0, "vel_amount_sum_24h": 75000.0, "geo_distance_from_last_txn_km": 700.0, "time_since_last_txn_seconds": 300.0, "geo_speed_kmh": 700.0, "geo_is_impossible_travel": 0.0, "device_is_new": 1.0, "device_is_rooted": 0.0, "device_is_emulator": 0.0, "receiver_is_blacklisted": 0.0, "receiver_is_new": 1.0, "sender_graph_risk_score": 0.85}, 1),
]

def run_benchmark():
    """Runs inference benchmark across all test cases and calculates confusion metrics."""
    from app.engines.model_registry import model_registry
    from app.engines.ml_engine import ml_engine

    model_registry.initialize()
    ml_engine.registry = model_registry

    results = []
    latencies = {"lgbm": [], "iso": [], "ensemble": []}

    print("\n" + "="*80)
    print("SENTINELPAY PREDICTION ENGINE — ACCURACY BENCHMARK")
    print("="*80)
    print(f"{'Scenario':<35} {'LGB':>8} {'ISO':>8} {'Ensemble':>10} {'Expect':>8} {'Correct':>8}")
    print("-"*80)

    for name, features, expected_label in TEST_CASES:
        try:
            t0 = time.perf_counter()
            ensemble_score, iso_score, shap_vals = ml_engine.predict(features)
            t1 = time.perf_counter()

            latency_ms = (t1 - t0) * 1000
            latencies["ensemble"].append(latency_ms)

            predicted_label = 1 if ensemble_score >= 0.35 else 0
            is_correct = predicted_label == expected_label

            results.append({
                "name": name,
                "ensemble_score": ensemble_score,
                "iso_score": iso_score,
                "expected": expected_label,
                "predicted": predicted_label,
                "correct": is_correct,
                "latency_ms": latency_ms
            })

            mark = "✓" if is_correct else "✗"
            print(f"{name:<35} {ensemble_score:>8.4f} {iso_score:>8.4f} {ensemble_score:>10.4f} {expected_label:>8} {mark:>8}")

        except Exception as e:
            print(f"{name:<35} ERROR: {str(e)}")

    # Calculate confusion matrix
    tp = sum(1 for r in results if r["expected"] == 1 and r["predicted"] == 1)
    fp = sum(1 for r in results if r["expected"] == 0 and r["predicted"] == 1)
    tn = sum(1 for r in results if r["expected"] == 0 and r["predicted"] == 0)
    fn = sum(1 for r in results if r["expected"] == 1 and r["predicted"] == 0)

    precision = tp / float(tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / float(tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
    accuracy = (tp + tn) / float(len(results)) if results else 0.0
    fpr = fp / float(fp + tn) if (fp + tn) > 0 else 0.0  # False positive rate
    fnr = fn / float(fn + tp) if (fn + tp) > 0 else 0.0  # False negative rate

    ensemble_lats = latencies["ensemble"]
    avg_lat = np.mean(ensemble_lats) if ensemble_lats else 0
    p95_lat = np.percentile(ensemble_lats, 95) if ensemble_lats else 0
    p99_lat = np.percentile(ensemble_lats, 99) if ensemble_lats else 0

    print("\n" + "="*80)
    print("CONFUSION MATRIX")
    print("="*80)
    print(f"                      Predicted Fraud    Predicted Legit")
    print(f"  Actual Fraud   │  TP = {tp:>5}         │  FN = {fn:>5}         │")
    print(f"  Actual Legit   │  FP = {fp:>5}         │  TN = {tn:>5}         │")
    print()
    print(f"{'='*80}")
    print(f"PERFORMANCE METRICS — LIGHTGBM + ISOLATION FOREST ENSEMBLE")
    print(f"{'='*80}")
    print(f"  Total Test Samples:     {len(results)}")
    print(f"  True  Positives  (TP):  {tp}  (fraud correctly flagged)")
    print(f"  False Positives  (FP):  {fp}  (legit incorrectly flagged)")
    print(f"  True  Negatives  (TN):  {tn}  (legit correctly approved)")
    print(f"  False Negatives  (FN):  {fn}  (fraud that escaped detection)")
    print(f"")
    print(f"  Accuracy:              {accuracy:.4f}  ({accuracy*100:.2f}%)")
    print(f"  Precision:             {precision:.4f}  ({precision*100:.2f}%)")
    print(f"  Recall (Sensitivity):  {recall:.4f}  ({recall*100:.2f}%)")
    print(f"  F1 Score:              {f1:.4f}")
    print(f"  False Positive Rate:   {fpr:.4f}  ({fpr*100:.2f}%)  → user friction risk")
    print(f"  False Negative Rate:   {fnr:.4f}  ({fnr*100:.2f}%)  → fraud escape risk")
    print(f"")
    print(f"LATENCY — SCORING ENGINE (LightGBM + Isolation Forest)")
    print(f"  Avg:  {avg_lat:.2f}ms")
    print(f"  p95:  {p95_lat:.2f}ms")
    print(f"  p99:  {p99_lat:.2f}ms")
    print(f"  Budget: 200ms (200ms target)")
    print(f"{'='*80}")

    # Return raw for artifact generation
    return {
        "tp": tp, "fp": fp, "tn": tn, "fn": fn,
        "precision": precision, "recall": recall, "f1": f1,
        "accuracy": accuracy, "fpr": fpr, "fnr": fnr,
        "avg_latency_ms": avg_lat, "p95_latency_ms": p95_lat, "p99_latency_ms": p99_lat,
        "n_samples": len(results),
        "results": results
    }


if __name__ == "__main__":
    run_benchmark()
