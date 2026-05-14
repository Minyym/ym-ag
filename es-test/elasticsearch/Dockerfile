FROM elasticsearch:8.17.0

# 先卸载避免重复
RUN elasticsearch-plugin remove analysis-ik || true \
    && elasticsearch-plugin install --batch \
    https://release.infinilabs.com/analysis-ik/stable/elasticsearch-analysis-ik-8.17.0.zip