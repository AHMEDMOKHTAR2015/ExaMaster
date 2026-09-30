# Build context: repository root (docker compose sets it; the service needs Directory.Packages.props and BuildingBlocks to restore)
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
USER app
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY Directory.Packages.props ./
COPY src/BuildingBlocks/ src/BuildingBlocks/
COPY src/Services/QuizMaster/ src/Services/QuizMaster/
RUN dotnet restore src/Services/QuizMaster/QuizMaster.API/QuizMaster.API.csproj
RUN dotnet publish src/Services/QuizMaster/QuizMaster.API/QuizMaster.API.csproj -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "QuizMaster.API.dll"]
