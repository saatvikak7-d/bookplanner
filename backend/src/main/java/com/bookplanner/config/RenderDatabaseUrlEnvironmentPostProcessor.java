package com.bookplanner.config;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.MutablePropertySources;
import org.springframework.util.StringUtils;

public class RenderDatabaseUrlEnvironmentPostProcessor implements EnvironmentPostProcessor {

    private static final String PROPERTY_SOURCE_NAME = "renderDatabaseUrl";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String databaseUrl = renderPostgresUrl(
            environment.getProperty("spring.datasource.url"),
            environment.getProperty("DATABASE_URL")
        );

        if (!StringUtils.hasText(databaseUrl)) {
            return;
        }

        URI uri = URI.create(databaseUrl);
        Map<String, Object> properties = new HashMap<>();
        properties.put("spring.datasource.url", toJdbcUrl(uri));

        Credentials credentials = extractCredentials(uri);
        if (StringUtils.hasText(credentials.username())) {
            properties.put("spring.datasource.username", credentials.username());
        }
        if (StringUtils.hasText(credentials.password())) {
            properties.put("spring.datasource.password", credentials.password());
        }

        properties.put("spring.jpa.database-platform", "org.hibernate.dialect.PostgreSQLDialect");

        MutablePropertySources sources = environment.getPropertySources();
        sources.addFirst(new MapPropertySource(PROPERTY_SOURCE_NAME, properties));
    }

    private static String renderPostgresUrl(String first, String second) {
        if (isRenderPostgresUrl(first)) {
            return first;
        }
        if (isRenderPostgresUrl(second)) {
            return second;
        }
        return "";
    }

    private static boolean isRenderPostgresUrl(String value) {
        return StringUtils.hasText(value)
            && (value.startsWith("postgres://") || value.startsWith("postgresql://"));
    }

    private static String toJdbcUrl(URI uri) {
        StringBuilder jdbcUrl = new StringBuilder("jdbc:postgresql://").append(uri.getHost());
        if (uri.getPort() > 0) {
            jdbcUrl.append(":").append(uri.getPort());
        }
        jdbcUrl.append(uri.getPath());
        if (StringUtils.hasText(uri.getQuery())) {
            jdbcUrl.append("?").append(uri.getQuery());
        }
        return jdbcUrl.toString();
    }

    private static Credentials extractCredentials(URI uri) {
        String userInfo = uri.getUserInfo();
        if (!StringUtils.hasText(userInfo)) {
            return new Credentials("", "");
        }

        String[] parts = userInfo.split(":", 2);
        String username = decode(parts[0]);
        String password = parts.length > 1 ? decode(parts[1]) : "";
        return new Credentials(username, password);
    }

    private static String decode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    private record Credentials(String username, String password) {
    }
}
