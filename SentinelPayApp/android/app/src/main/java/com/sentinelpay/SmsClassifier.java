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
        if (classifier == null) {
            Log.w(TAG, "Classifier is null, returning default score 0.0");
            return 0.0f;
        }

        try {
            List<Category> results = classifier.classify(text);
            // The model returns Positive (index 1) and Negative (index 0) sentiments.
            // We'll treat 'Negative' sentiment as Spam/Fraud for this demo, 
            // but in reality we'd use a dedicated spam model.
            for (Category category : results) {
                if (category.getLabel().equals("Negative") || category.getLabel().equals("1")) {
                    return category.getScore();
                }
            }
            
            // If labels are not named, assume index 1 is fraud
            if (results.size() > 1) {
                return results.get(1).getScore();
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
