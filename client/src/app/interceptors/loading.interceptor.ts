import { Injectable, inject } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../services/loading.service';
import { ApiClient } from '../services/api/api-client.service';

/**
 * HTTP Interceptor to automatically show/hide loading spinner
 * Tracks all HTTP requests and manages loading state centrally
 */
@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
  private readonly loadingService = inject(LoadingService);

  // URLs to exclude from loading spinner (e.g., background polling, quick updates)
  private readonly excludedUrls: string[] = [
    // Add any URLs that shouldn't trigger loading spinner
  ];

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    // Check if this request should show loading spinner
    const shouldShowLoading = !this.isExcluded(request.url);

    if (shouldShowLoading) {
      this.loadingService.show();
    }

    return next.handle(request).pipe(
      finalize(() => {
        if (shouldShowLoading) {
          this.loadingService.hide();
        }
      })
    );
  }

  /**
   * Check if URL is in the excluded list
   */
  private isExcluded(url: string): boolean {
    // API calls are data loads that screens show their own progress for (BaseComponent's
    // `loading`). Through here, every one of them would flash the full-page overlay.
    if (ApiClient.isApiRequest(url)) return true;
    return this.excludedUrls.some(excluded => url.includes(excluded));
  }
}
