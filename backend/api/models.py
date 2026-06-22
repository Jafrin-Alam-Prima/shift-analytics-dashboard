from django.db import models


class SavedReport(models.Model):
    """A saved analysis: the dataset rows + the parameters that produced it, plus
    a small summary for the list. Reloading one restores the whole view."""

    name = models.CharField(max_length=200)
    created = models.DateTimeField(auto_now_add=True)
    rows = models.JSONField(default=list)  # logical rows (date/start/end/hours/reason)
    params = models.JSONField(default=dict)
    mode = models.CharField(max_length=10, default="clean")
    filters = models.JSONField(default=dict)
    summary = models.JSONField(default=dict)  # efficiency, streak count, etc.
    notes = models.TextField(default="", blank=True)  # manager notes (human-written)

    class Meta:
        ordering = ["-created"]

    def __str__(self):
        return f"{self.name} ({self.created:%Y-%m-%d})"
