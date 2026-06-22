from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health),
    path("analyze/", views.analyze_view),
    path("validate/", views.validate),
    path("reports/", views.reports),
    path("reports/<int:pk>/", views.report_detail),
]
