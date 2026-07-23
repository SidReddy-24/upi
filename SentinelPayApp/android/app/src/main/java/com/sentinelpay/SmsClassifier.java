package com.sentinelpay;

import android.content.Context;
import android.util.Log;
import org.tensorflow.lite.task.text.nlclassifier.NLClassifier;
import org.tensorflow.lite.support.label.Category;
import java.io.IOException;
import java.util.List;

public class SmsClassifier {
    private static final String TAG = "SmsClassifier";
    private static final String MODEL_PATH = "spam_classifier.tflite";
    private NLClassifier classifier;

    public SmsClassifier(Context context) {
        try {
            Log.d(TAG, "Initializing TFLite NLClassifier...");
            NLClassifier.NLClassifierOptions options =
                    NLClassifier.NLClassifierOptions.builder().build();
            classifier = NLClassifier.createFromFileAndOptions(context, MODEL_PATH, options);
            Log.d(TAG, "TFLite model loaded successfully.");
        } catch (IOException e) {
            Log.e(TAG, "Failed to load TFLite model: " + e.getMessage());
            classifier = null;
        }
    }

    /**
     * Classifies the text and returns a fraud probability (0.0 to 1.0).
     */
    public float classify(String text) {
        if (text == null || text.trim().isEmpty()) {
            return 0.0f;
        }

        String lowerText = text.toLowerCase();

        // 1. Phishing / Scam explicit keywords -> High Fraud Score
        if (lowerText.contains("bit.ly") ||
            lowerText.contains("tinyurl") ||
            lowerText.contains("claim prize") ||
            lowerText.contains("won lottery") ||
            lowerText.contains("account suspended") ||
            lowerText.contains("update kyc now") ||
            lowerText.contains("part time job") ||
            lowerText.contains("earn daily") ||
            lowerText.contains("telegram.me") ||
            lowerText.contains("click here to verify")) {
            return 0.95f;
        }

        // 2. Real Bank Transaction keywords -> Safe / Genuine (0.0f)
        boolean isBankTxn = lowerText.contains("debited") ||
                            lowerText.contains("credited") ||
                            lowerText.contains("transferred") ||
                            lowerText.contains("received") ||
                            lowerText.contains("available balance") ||
                            lowerText.contains("avbl bal") ||
                            lowerText.contains("a/c") ||
                            lowerText.contains("acct") ||
                            lowerText.contains("upi ref") ||
                            lowerText.contains("vpa") ||
                            lowerText.contains("spent on card") ||
                            lowerText.contains("atm withdrawal");

        if (isBankTxn && !lowerText.contains("share pin") && !lowerText.contains("share password")) {
            return 0.0f;
        }

        if (classifier == null) {
            Log.w(TAG, "Classifier is null, returning default score 0.0");
            return 0.0f;
        }

        try {
            List<Category> results = classifier.classify(text);
            for (Category category : results) {
                if (category.getLabel().equals("Negative") || category.getLabel().equals("1")) {
                    // Cap raw TFLite sentiment score at 0.3 for banking text
                    float score = category.getScore();
                    return isBankTxn ? Math.min(score, 0.2f) : score;
                }
            }
            
            if (results.size() > 1) {
                float score = results.get(1).getScore();
                return isBankTxn ? Math.min(score, 0.2f) : score;
            }

        } catch (Exception e) {
            Log.e(TAG, "Classification error: " + e.getMessage());
        }
        return 0.0f;
    }

    public void close() {
        if (classifier != null) {
            classifier.close();
        }
    }
}

